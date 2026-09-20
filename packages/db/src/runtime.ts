import { performHttpCheck } from '@alivecheck/shared/checker';
import { sendSmtp, sendWebhook } from '@alivecheck/shared/dispatch';
import { decryptJson, type SmtpConfig, type WebhookConfig, type MonitorEvent } from '@alivecheck/shared';
import { prisma } from './client.js';
import { recordMonitorCheck } from './checks.js';

export async function dispatchMonitorEvent(
  encryptionKey: string,
  monitorId: string,
  userId: string,
  event: MonitorEvent,
): Promise<{ sent: number; errors: string[] }> {
  let links = await prisma.monitorNotification.findMany({
    where: { monitorId, enabled: true, provider: { userId, enabled: true } },
    include: { provider: true },
  });

  // V1 fallback: if the monitor has no linked providers, notify via every enabled provider.
  if (links.length === 0) {
    const providers = await prisma.notificationProvider.findMany({
      where: { userId, enabled: true },
    });
    links = providers.map((provider) => ({
      id: `fallback-${provider.id}`,
      monitorId,
      providerId: provider.id,
      enabled: true,
      provider,
    }));
  }

  if (links.length === 0) {
    console.warn(
      `No notification providers for monitor ${monitorId} (user ${userId}); skipped ${event.event}`,
    );
    return { sent: 0, errors: ['No enabled notification providers'] };
  }

  console.log(`Dispatching ${event.event} for monitor ${monitorId} to ${links.length} provider(s)`);

  let sent = 0;
  const errors: string[] = [];

  for (const link of links) {
    try {
      if (link.provider.type === 'SMTP') {
        const config = decryptJson<SmtpConfig>(encryptionKey, link.provider.encryptedConfig);
        await sendSmtp(config, event);
      } else {
        const config = decryptJson<WebhookConfig>(encryptionKey, link.provider.encryptedConfig);
        await sendWebhook(config, event);
      }
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown delivery error';
      console.error(`Notification ${link.provider.id} failed:`, error);
      errors.push(message);
    }
  }

  return { sent, errors };
}

export async function runMonitorCheck(options: {
  monitorId: string;
  userId?: string;
  encryptionKey: string;
  userAgent: string;
  updateSchedule: boolean;
}) {
  const monitor = await prisma.monitor.findFirst({
    where: {
      id: options.monitorId,
      ...(options.userId ? { userId: options.userId } : {}),
    },
  });
  if (!monitor) {
    return null;
  }

  const result = await performHttpCheck({
    url: monitor.url,
    method: monitor.method,
    timeoutSeconds: monitor.timeoutSeconds,
    expectedStatus: monitor.expectedStatus,
    userAgent: options.userAgent,
  });

  const recorded = await recordMonitorCheck(monitor, result, {
    updateSchedule: options.updateSchedule,
  });

  if (recorded.transition.event) {
    await dispatchMonitorEvent(options.encryptionKey, monitor.id, monitor.userId, {
      event: recorded.transition.event,
      monitor: monitor.name,
      url: monitor.url,
      timestamp: new Date().toISOString(),
      httpStatus: result.statusCode,
      errorType: result.errorType,
    });
  }

  return recorded;
}
