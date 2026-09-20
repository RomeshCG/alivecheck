import nodemailer from 'nodemailer';
import { fetch } from 'undici';
import type { SmtpConfig, WebhookConfig } from './schemas.js';
import { formatEventBody, formatEventSubject, type MonitorEvent } from './notifications.js';
import { assertSafeHttpUrl } from './ssrf.js';

export class NotificationDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationDeliveryError';
  }
}

function smtpTransportOptions(config: SmtpConfig) {
  // Port 465 = implicit TLS. Port 587 = STARTTLS (secure must be false).
  const secure = config.port === 465 ? true : config.port === 587 ? false : config.secure;

  return {
    host: config.host,
    port: config.port,
    secure,
    requireTLS: config.port === 587 || (!secure && config.port !== 25),
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  };
}

function formatSmtpError(error: unknown): string {
  const err = error as { code?: string; responseCode?: number; message?: string; response?: string };
  if (err.code === 'EAUTH' || err.responseCode === 535) {
    return 'SMTP login failed. Check username/password (use a Gmail App Password, not your normal password).';
  }
  if (err.code === 'ESOCKET' || err.message?.includes('wrong version number')) {
    return 'SMTP TLS mismatch. For Gmail use port 587 with TLS checkbox OFF, or port 465 with TLS ON.';
  }
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNECTION') {
    return 'Could not reach the SMTP server. Check host/port and your network.';
  }
  if (err.response) {
    return `SMTP rejected the message: ${err.response}`;
  }
  return err.message ? `SMTP error: ${err.message}` : 'SMTP delivery failed';
}

export async function sendSmtp(config: SmtpConfig, event: MonitorEvent): Promise<void> {
  const transporter = nodemailer.createTransport(smtpTransportOptions(config));

  try {
    await transporter.sendMail({
      from: config.from,
      to: config.to,
      subject: formatEventSubject(event),
      text: formatEventBody(event),
    });
  } catch (error) {
    throw new NotificationDeliveryError(formatSmtpError(error));
  } finally {
    transporter.close();
  }
}

export async function sendWebhook(config: WebhookConfig, event: MonitorEvent): Promise<void> {
  await assertSafeHttpUrl(config.url);

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'AliveCheck/1.0',
  };
  if (config.secret) {
    headers['x-alivecheck-secret'] = config.secret;
  }

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: event.event,
        monitor: event.monitor,
        url: event.url,
        timestamp: event.timestamp,
        httpStatus: event.httpStatus ?? null,
        errorType: event.errorType ?? null,
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });

    if (!response.ok) {
      throw new NotificationDeliveryError(`Webhook responded with ${response.status}`);
    }
  } catch (error) {
    if (error instanceof NotificationDeliveryError) throw error;
    throw new NotificationDeliveryError(
      error instanceof Error ? `Webhook failed: ${error.message}` : 'Webhook failed',
    );
  }
}
