import { loadRootEnv } from '@alivecheck/shared';

loadRootEnv(import.meta.url, 4);

function required(name: string, minLength = 1): string {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(
      minLength > 1
        ? `Missing or too short environment variable ${name} (need at least ${minLength} chars)`
        : `Missing required environment variable ${name}`,
    );
  }
  return value;
}

function requireDatabaseUrls(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      'Set DATABASE_URL+DIRECT_URL, or set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD so AliveCheck can derive them.',
    );
  }
  if (!process.env.DIRECT_URL?.trim()) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
}

requireDatabaseUrls();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Prefer PLATFORM PORT (Render/Railway/Fly); fall back to API_PORT for local.
  apiPort: Number(process.env.PORT ?? process.env.API_PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  sessionSecret: required('SESSION_SECRET', 32),
  encryptionKey: required('ENCRYPTION_KEY', 64),
  checkerUserAgent: process.env.CHECKER_USER_AGENT ?? 'AliveCheck/1.0',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null,
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    null,
};
