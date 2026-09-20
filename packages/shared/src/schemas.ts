import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const monitorMethodSchema = z.enum(['GET', 'HEAD']);

export const createMonitorSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().url().max(2048),
  method: monitorMethodSchema.default('GET'),
  intervalSeconds: z.number().int().min(30).max(3600).default(60),
  timeoutSeconds: z.number().int().min(1).max(60).default(10),
  expectedStatus: z.number().int().min(100).max(599).default(200),
  failureThreshold: z.number().int().min(1).max(20).default(3),
  recoveryThreshold: z.number().int().min(1).max(20).default(2),
  enabled: z.boolean().default(true),
  providerIds: z.array(z.string().min(1)).max(20).optional(),
});

export const updateMonitorSchema = createMonitorSchema.partial();

export const smtpConfigSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  user: z.string().min(0).max(255).optional(),
  password: z.string().min(0).max(255).optional(),
  from: z.string().trim().min(1).max(320),
  to: z.string().trim().min(1).max(320),
});

export const webhookConfigSchema = z.object({
  url: z.string().trim().url().max(2048),
  secret: z.string().max(512).optional(),
});

export const createNotificationProviderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SMTP'),
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean().default(true),
    config: smtpConfigSchema,
  }),
  z.object({
    type: z.literal('WEBHOOK'),
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean().default(true),
    config: webhookConfigSchema,
  }),
]);

export const updateNotificationProviderSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  config: z.union([smtpConfigSchema, webhookConfigSchema]).optional(),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
export type SmtpConfig = z.infer<typeof smtpConfigSchema>;
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
