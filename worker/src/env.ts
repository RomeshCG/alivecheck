import { loadRootEnv } from '@alivecheck/shared';

loadRootEnv(import.meta.url, 2);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error(
    'Set DATABASE_URL+DIRECT_URL, or set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD so AliveCheck can derive them.',
  );
}
if (!process.env.DIRECT_URL?.trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export const workerEnv = {
  encryptionKey: required('ENCRYPTION_KEY'),
  checkerUserAgent: process.env.CHECKER_USER_AGENT ?? 'AliveCheck/1.0',
};
