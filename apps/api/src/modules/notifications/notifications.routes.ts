import { prisma } from '@alivecheck/db';
import {
  assertSafeHttpUrl,
  createNotificationProviderSchema,
  type SmtpConfig,
  type WebhookConfig,
  updateNotificationProviderSchema,
} from '@alivecheck/shared';
import { sendSmtp, sendWebhook, NotificationDeliveryError } from '@alivecheck/shared/dispatch';
import { Router } from 'express';
import { encryptConfig, decryptConfig, maskSecret } from '../../lib/crypto.js';
import { asyncHandler, HttpError, requireAuth } from '../../middleware/error.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

function sanitizeProvider(
  provider: {
    id: string;
    type: 'SMTP' | 'WEBHOOK';
    name: string;
    encryptedConfig: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  const config =
    provider.type === 'SMTP'
      ? decryptConfig<SmtpConfig>(provider.encryptedConfig)
      : decryptConfig<WebhookConfig>(provider.encryptedConfig);

  if (provider.type === 'SMTP') {
    const smtp = config as SmtpConfig;
    return {
      id: provider.id,
      type: provider.type,
      name: provider.name,
      enabled: provider.enabled,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      config: {
        ...smtp,
        password: maskSecret(smtp.password),
      },
    };
  }

  const webhook = config as WebhookConfig;
  return {
    id: provider.id,
    type: provider.type,
    name: provider.name,
    enabled: provider.enabled,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    config: {
      ...webhook,
      secret: maskSecret(webhook.secret),
    },
  };
}

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const providers = await prisma.notificationProvider.findMany({
      where: { userId: req.session.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ providers: providers.map(sanitizeProvider) });
  }),
);

notificationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createNotificationProviderSchema.parse(req.body);
    if (body.type === 'WEBHOOK') {
      await assertSafeHttpUrl(body.config.url);
    }
    const provider = await prisma.notificationProvider.create({
      data: {
        userId: req.session.userId!,
        type: body.type,
        name: body.name,
        enabled: body.enabled,
        encryptedConfig: encryptConfig(body.config),
      },
    });
    res.status(201).json({ provider: sanitizeProvider(provider) });
  }),
);

notificationsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateNotificationProviderSchema.parse(req.body);
    const existing = await prisma.notificationProvider.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Provider not found');

    let encryptedConfig = existing.encryptedConfig;
    if (body.config) {
      const current =
        existing.type === 'SMTP'
          ? decryptConfig<SmtpConfig>(existing.encryptedConfig)
          : decryptConfig<WebhookConfig>(existing.encryptedConfig);
      const next = { ...current, ...body.config };
      if (existing.type === 'WEBHOOK' && 'url' in next && typeof next.url === 'string') {
        await assertSafeHttpUrl(next.url);
      }
      encryptedConfig = encryptConfig(next);
    }

    const provider = await prisma.notificationProvider.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        enabled: body.enabled,
        encryptedConfig,
      },
    });
    res.json({ provider: sanitizeProvider(provider) });
  }),
);

notificationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.notificationProvider.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Provider not found');
    await prisma.notificationProvider.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);

notificationsRouter.post(
  '/:id/test',
  asyncHandler(async (req, res) => {
    const existing = await prisma.notificationProvider.findFirst({
      where: { id: req.params.id, userId: req.session.userId },
    });
    if (!existing) throw new HttpError(404, 'Provider not found');

    const event = {
      event: 'monitor.test' as const,
      monitor: 'AliveCheck test',
      url: 'https://example.com/health',
      timestamp: new Date().toISOString(),
    };

    try {
      if (existing.type === 'SMTP') {
        await sendSmtp(decryptConfig<SmtpConfig>(existing.encryptedConfig), event);
      } else {
        await sendWebhook(decryptConfig<WebhookConfig>(existing.encryptedConfig), event);
      }
    } catch (error) {
      if (error instanceof NotificationDeliveryError) {
        throw new HttpError(502, error.message);
      }
      throw error;
    }

    res.json({ ok: true });
  }),
);
