import { prisma } from './client.js';
import { applyCheckResult } from '@alivecheck/shared';
import type { CheckErrorType, Monitor, Prisma } from '@prisma/client';

export type CheckPayload = {
  success: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  errorType: CheckErrorType | null;
  responseSize: number | null;
};

export type RecordedCheck = {
  result: CheckPayload;
  transition: ReturnType<typeof applyCheckResult>;
  monitor: Monitor;
};

export async function recordMonitorCheck(
  monitor: Monitor,
  result: CheckPayload,
  options: { updateSchedule: boolean },
): Promise<RecordedCheck> {
  const transition = applyCheckResult(
    {
      currentStatus: monitor.currentStatus,
      consecutiveFailures: monitor.consecutiveFailures,
      consecutiveSuccesses: monitor.consecutiveSuccesses,
      failureThreshold: monitor.failureThreshold,
      recoveryThreshold: monitor.recoveryThreshold,
    },
    result.success,
  );

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.monitorCheck.create({
      data: {
        monitorId: monitor.id,
        success: result.success,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        errorType: result.errorType,
        responseSize: result.responseSize,
        checkedAt: now,
      },
    });

    const data: Prisma.MonitorUpdateInput = {
      currentStatus: transition.currentStatus,
      consecutiveFailures: transition.consecutiveFailures,
      consecutiveSuccesses: transition.consecutiveSuccesses,
    };
    if (options.updateSchedule) {
      data.lastCheckedAt = now;
    }

    const next = await tx.monitor.update({
      where: { id: monitor.id },
      data,
    });

    if (transition.openedIncident) {
      await tx.incident.create({
        data: {
          monitorId: monitor.id,
          startedAt: now,
          errorSummary: result.errorType ?? `HTTP ${result.statusCode ?? 'unknown'}`,
        },
      });
    }

    if (transition.resolvedIncident) {
      const open = await tx.incident.findFirst({
        where: { monitorId: monitor.id, resolvedAt: null },
        orderBy: { startedAt: 'desc' },
      });
      if (open) {
        await tx.incident.update({
          where: { id: open.id },
          data: {
            resolvedAt: now,
            durationMs: now.getTime() - open.startedAt.getTime(),
          },
        });
      }
    }

    return next;
  });

  return { result, transition, monitor: updated };
}
