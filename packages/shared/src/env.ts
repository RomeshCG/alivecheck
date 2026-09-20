import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve Postgres URLs for Prisma.
 *
 * AliveCheck can use either:
 * 1. Explicit DATABASE_URL + DIRECT_URL (any Postgres / Supabase connection strings)
 * 2. NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD (derive db.<ref>.supabase.co URLs)
 *
 * NEXT_PUBLIC_SUPABASE_URL + the publishable/anon key alone cannot open Postgres.
 * Those are for the Supabase HTTP API, not Prisma.
 */
export function loadRootEnv(fromFileUrl: string, levelsUp = 3): void {
  const rootEnv = resolve(dirname(fileURLToPath(fromFileUrl)), '../'.repeat(levelsUp) + '.env');
  config({ path: rootEnv, override: true });
  applySupabaseDerivedDatabaseUrls();
}

export function projectRefFromSupabaseUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function buildSupabasePoolerUrls(
  projectRef: string,
  password: string,
  region: string,
): { databaseUrl: string; directUrl: string } {
  const encoded = encodeURIComponent(password);
  const user = `postgres.${projectRef}`;
  const host = `aws-0-${region}.pooler.supabase.com`;
  return {
    // Transaction pooler — app runtime
    databaseUrl: `postgresql://${user}:${encoded}@${host}:6543/postgres?pgbouncer=true&sslmode=require`,
    // Session pooler — migrations (IPv4-friendly; avoids db.*.supabase.co IPv6-only DNS)
    directUrl: `postgresql://${user}:${encoded}@${host}:5432/postgres?sslmode=require`,
  };
}

export function buildSupabaseDirectUrl(projectRef: string, password: string): string {
  const encoded = encodeURIComponent(password);
  return `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
}

export function applySupabaseDerivedDatabaseUrls(): void {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasDirectUrl = Boolean(process.env.DIRECT_URL?.trim());
  if (hasDatabaseUrl && hasDirectUrl) {
    return;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!supabaseUrl || !password) {
    return;
  }

  const projectRef = projectRefFromSupabaseUrl(supabaseUrl);
  if (!projectRef) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL must look like https://<project-ref>.supabase.co to derive DATABASE_URL',
    );
  }

  const region = process.env.SUPABASE_REGION?.trim() || 'ap-southeast-1';
  const preferDirect = process.env.SUPABASE_USE_DIRECT_DB === 'true';

  if (preferDirect) {
    const derived = buildSupabaseDirectUrl(projectRef, password);
    if (!hasDatabaseUrl) process.env.DATABASE_URL = derived;
    if (!hasDirectUrl) process.env.DIRECT_URL = derived;
    return;
  }

  const urls = buildSupabasePoolerUrls(projectRef, password, region);
  if (!hasDatabaseUrl) process.env.DATABASE_URL = urls.databaseUrl;
  if (!hasDirectUrl) process.env.DIRECT_URL = urls.directUrl;
}

export function getSupabasePublicConfig(): {
  url: string | null;
  publishableKey: string | null;
} {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || null,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      null,
  };
}
