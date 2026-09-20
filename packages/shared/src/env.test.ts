import { describe, expect, it, afterEach } from 'vitest';
import {
  applySupabaseDerivedDatabaseUrls,
  buildSupabaseDirectUrl,
  buildSupabasePoolerUrls,
  projectRefFromSupabaseUrl,
} from './env.js';

describe('Supabase env helpers', () => {
  const keys = [
    'DATABASE_URL',
    'DIRECT_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_DB_PASSWORD',
  ] as const;
  const snapshot: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  afterEach(() => {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  });

  function capture() {
    for (const key of keys) {
      snapshot[key] = process.env[key];
    }
  }

  it('extracts project ref from NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(projectRefFromSupabaseUrl('https://bamhpwjygxoitwwymreu.supabase.co')).toBe(
      'bamhpwjygxoitwwymreu',
    );
  });

  it('builds pooler URLs for Windows-friendly IPv4', () => {
    const urls = buildSupabasePoolerUrls('bamhpwjygxoitwwymreu', 'p@ss', 'ap-northeast-2');
    expect(urls.databaseUrl).toContain('aws-0-ap-northeast-2.pooler.supabase.com:6543');
    expect(urls.directUrl).toContain(':5432/postgres');
    expect(urls.databaseUrl).toContain('postgres.bamhpwjygxoitwwymreu');
  });

  it('builds a SSL Postgres URL', () => {
    expect(buildSupabaseDirectUrl('bamhpwjygxoitwwymreu', 'p@ss')).toBe(
      'postgresql://postgres:p%40ss@db.bamhpwjygxoitwwymreu.supabase.co:5432/postgres?sslmode=require',
    );
  });

  it('derives DATABASE_URL when missing', () => {
    capture();
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://bamhpwjygxoitwwymreu.supabase.co';
    process.env.SUPABASE_DB_PASSWORD = 'secret';
    process.env.SUPABASE_REGION = 'ap-northeast-2';
    applySupabaseDerivedDatabaseUrls();
    expect(process.env.DATABASE_URL).toContain('pooler.supabase.com');
    expect(process.env.DIRECT_URL).toContain('pooler.supabase.com');
  });
});
