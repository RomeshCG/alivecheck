import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const loaded = config({ path: resolve(root, '.env'), override: true });
if (loaded.error) {
  console.error('Failed to load .env:', loaded.error.message);
  process.exit(1);
}

function projectRefFromSupabaseUrl(url) {
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function applySupabaseDerivedDatabaseUrls() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasDirectUrl = Boolean(process.env.DIRECT_URL?.trim());
  if (hasDatabaseUrl && hasDirectUrl) return;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!supabaseUrl || !password) return;

  const projectRef = projectRefFromSupabaseUrl(supabaseUrl);
  if (!projectRef) {
    console.error('NEXT_PUBLIC_SUPABASE_URL must look like https://<project-ref>.supabase.co');
    process.exit(1);
  }

  const region = process.env.SUPABASE_REGION?.trim() || 'ap-southeast-1';
  const encoded = encodeURIComponent(password);
  const user = `postgres.${projectRef}`;
  const host = `aws-0-${region}.pooler.supabase.com`;

  if (!hasDatabaseUrl) {
    process.env.DATABASE_URL = `postgresql://${user}:${encoded}@${host}:6543/postgres?pgbouncer=true&sslmode=require`;
  }
  if (!hasDirectUrl) {
    process.env.DIRECT_URL = `postgresql://${user}:${encoded}@${host}:5432/postgres?sslmode=require`;
  }
}

applySupabaseDerivedDatabaseUrls();

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    'Missing database config. Set DATABASE_URL+DIRECT_URL, or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD.',
  );
  process.exit(1);
}
if (!process.env.DIRECT_URL?.trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/with-env.mjs <prisma-args...>');
  process.exit(1);
}

const hostHint = (() => {
  try {
    return new URL(process.env.DATABASE_URL.replace(/^postgresql:/, 'http:')).hostname;
  } catch {
    return 'unknown';
  }
})();
console.log(`Connecting via ${hostHint}`);

const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
  cwd: resolve(here, '..'),
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
