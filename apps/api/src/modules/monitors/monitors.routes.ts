import { prisma, runMonitorCheck, dispatchMonitorEvent } from '@alivecheck/db';
import {
  assertSafeHttpUrl,
  calculateUptimePercent,
  createMonitorSchema,
  updateMonitorSchema,
  UPTIME_WINDOWS_MS,
} from '@alivecheck/shared';
import { Router } from 'express';
import { asyncHandler, HttpError, requireAuth } from '../../middleware/error.js';
import { env } from '../../lib/env.js';
import { NotificationDeliveryError } from '@alivecheck/shared/dispatch';

export const monitorsRouter = Router();
monitorsRouter.use(requireAuth);

monitorsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const monitors = await prisma.monitor.findMany({
      where: { userId: req.session.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ monitors });
  }),
);

monitorsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createMonitorSchema.parse(req.body);
    await assertSafeHttpUrl(body.url);

    const monitor = await prisma.$transaction(async (tx) => {
      const created = await tx.monitor.create({
        data: {
          userId: req.session.userId!,
          name: body.name,
          url: body.url,
          method: body.method,
          intervalSeconds: body.intervalSeconds,
          timeoutSeconds: body.timeoutSeconds,
          expectedStatus: body.expectedStatus,
          failureThreshold: body.failureThreshold,
          recoveryThreshold: body.recoveryThreshold,
          enabled: body.enabled,
        },
      });

      if (body.providerIds?.length) {
        const owned = await tx.notificationProvider.findMany({
          where: { id: { in: body.providerIds }, userId: req.session.userId },
          select: { id: true },
        });
        if (owned.length) {
          await tx.monitorNotification.createMany({
            data: owned.map((provider) => ({
              monitorId: created.id,
              providerId: provider.id,
            })),
          });
        }
      }

      return created;
    });

    res.status(201).json({ monitor });
  }),
);

monitorsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const monitor = await prisma.monitor.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
      include: {
        notifications: { include: { provider: { select: { id: true, name: true, type: true, enabled: true } } } },
      },
    });
    if (!monitor) throw new HttpError(404, 'Monitor not found');
    res.json({ monitor });
  }),
);

monitorsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateMonitorSchema.parse(req.body);
    const existing = await prisma.monitor.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Monitor not found');
    if (body.url) await assertSafeHttpUrl(body.url);

    const monitor = await prisma.$transaction(async (tx) => {
      const updated = await tx.monitor.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          url: body.url,
          method: body.method,
          intervalSeconds: body.intervalSeconds,
          timeoutSeconds: body.timeoutSeconds,
          expectedStatus: body.expectedStatus,
          failureThreshold: body.failureThreshold,
          recoveryThreshold: body.recoveryThreshold,
          enabled: body.enabled,
        },
      });

      if (body.providerIds) {
        await tx.monitorNotification.deleteMany({ where: { monitorId: existing.id } });
        if (body.providerIds.length) {
          const owned = await tx.notificationProvider.findMany({
            where: { id: { in: body.providerIds }, userId: req.session.userId },
            select: { id: true },
          });
          if (owned.length) {
            await tx.monitorNotification.createMany({
              data: owned.map((provider) => ({
                monitorId: existing.id,
                providerId: provider.id,
              })),
            });
          }
        }
      }

      return updated;
    });

    // If providers were linked while the monitor is already DOWN, send the alert now.
    // (Transitions only fire once — later failures while DOWN do not email again.)
    if (body.providerIds && body.providerIds.length > 0 && monitor.currentStatus === 'DOWN') {
      try {
        await dispatchMonitorEvent(env.encryptionKey, monitor.id, req.session.userId!, {
          event: 'monitor.down',
          monitor: monitor.name,
          url: monitor.url,
          timestamp: new Date().toISOString(),
          errorType: 'HTTP_STATUS',
        });
      } catch (error) {
        console.error('Failed to notify after linking providers:', error);
      }
    }

    res.json({ monitor });
  }),
);

monitorsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.monitor.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Monitor not found');
    await prisma.monitor.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);

monitorsRouter.post(
  '/:id/check',
  asyncHandler(async (req, res) => {
    const recorded = await runMonitorCheck({
      monitorId: req.params.id,
      userId: req.session.userId,
      encryptionKey: env.encryptionKey,
      userAgent: env.checkerUserAgent,
      updateSchedule: false,
    });
    if (!recorded) throw new HttpError(404, 'Monitor not found');
    res.json({
      status: recorded.monitor.currentStatus.toLowerCase(),
      httpStatus: recorded.result.statusCode,
      responseTime: recorded.result.responseTimeMs,
      checkedAt: new Date().toISOString(),
      success: recorded.result.success,
      errorType: recorded.result.errorType,
      event: recorded.transition.event,
      notified: Boolean(recorded.transition.event),
      consecutiveFailures: recorded.monitor.consecutiveFailures,
      failureThreshold: recorded.monitor.failureThreshold,
    });
  }),
);

monitorsRouter.post(
  '/:id/notify',
  asyncHandler(async (req, res) => {
    const existing = await prisma.monitor.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Monitor not found');

    const eventType =
      existing.currentStatus === 'DOWN'
        ? ('monitor.down' as const)
        : existing.currentStatus === 'UP' || existing.currentStatus === 'RECOVERED'
          ? ('monitor.recovered' as const)
          : null;

    if (!eventType) {
      throw new HttpError(400, 'Monitor has no DOWN/UP status to notify about yet');
    }

    try {
      const result = await dispatchMonitorEvent(env.encryptionKey, existing.id, existing.userId, {
        event: eventType,
        monitor: existing.name,
        url: existing.url,
        timestamp: new Date().toISOString(),
      });
      if (result.sent === 0) {
        throw new HttpError(502, result.errors[0] ?? 'No notification was delivered');
      }
      res.json({ ok: true, event: eventType, sent: result.sent });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof NotificationDeliveryError) {
        throw new HttpError(502, error.message);
      }
      throw error;
    }
  }),
);

monitorsRouter.post(
  '/:id/pause',
  asyncHandler(async (req, res) => {
    const existing = await prisma.monitor.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Monitor not found');
    const monitor = await prisma.monitor.update({
      where: { id: existing.id },
      data: { enabled: false },
    });
    res.json({ monitor });
  }),
);

monitorsRouter.post(
  '/:id/resume',
  asyncHandler(async (req, res) => {
    const existing = await prisma.monitor.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Monitor not found');
    const monitor = await prisma.monitor.update({
      where: { id: existing.id },
      data: { enabled: true },
    });
    res.json({ monitor });
  }),
);

monitorsRouter.get(
  '/:id/checks',
  asyncHandler(async (req, res) => {
    const existing = await prisma.monitor.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Monitor not found');
    const checks = await prisma.monitorCheck.findMany({
      where: { monitorId: existing.id },
      orderBy: { checkedAt: 'desc' },
      take: 200,
    });
    res.json({ checks });
  }),
);

monitorsRouter.get(
  '/:id/uptime',
  asyncHandler(async (req, res) => {
    const existing = await prisma.monitor.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Monitor not found');

    const now = Date.now();
    const windows = {
      hour: now - UPTIME_WINDOWS_MS.hour,
      day: now - UPTIME_WINDOWS_MS.day,
      week: now - UPTIME_WINDOWS_MS.week,
      month: now - UPTIME_WINDOWS_MS.month,
    };

    const counts = await Promise.all(
      Object.entries(windows).map(async ([key, from]) => {
        const [total, successful] = await Promise.all([
          prisma.monitorCheck.count({
            where: { monitorId: existing.id, checkedAt: { gte: new Date(from) } },
          }),
          prisma.monitorCheck.count({
            where: {
              monitorId: existing.id,
              success: true,
              checkedAt: { gte: new Date(from) },
            },
          }),
        ]);
        return [key, calculateUptimePercent(successful, total)] as const;
      }),
    );

    res.json({ uptime: Object.fromEntries(counts) });
  }),
);

monitorsRouter.get(
  '/:id/incidents',
  asyncHandler(async (req, res) => {
    const existing = await prisma.monitor.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Monitor not found');
    const incidents = await prisma.incident.findMany({
      where: { monitorId: existing.id },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    res.json({ incidents });
  }),
);
