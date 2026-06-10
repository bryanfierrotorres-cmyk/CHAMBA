#!/usr/bin/env node
/** RLS worker_profiles (complemento post-039). npm run db:apply-worker-profiles-rls */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SQL = `
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_profiles: select own" ON worker_profiles;
CREATE POLICY "worker_profiles: select own"
  ON worker_profiles FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

DROP POLICY IF EXISTS "worker_profiles: admin select all" ON worker_profiles;
CREATE POLICY "worker_profiles: admin select all"
  ON worker_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin')
  );

DROP POLICY IF EXISTS "worker_profiles: authenticated read ratings" ON worker_profiles;
CREATE POLICY "worker_profiles: authenticated read ratings"
  ON worker_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "worker_profiles: upsert own" ON worker_profiles;
CREATE POLICY "worker_profiles: upsert own"
  ON worker_profiles FOR ALL TO authenticated
  USING (worker_id = auth.uid()) WITH CHECK (worker_id = auth.uid());
`;

function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const raw = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!raw) {
  console.error('❌ SUPABASE_DB_URL en .env');
  process.exit(1);
}

const url = raw.includes(':6543') ? raw.replace(':6543', ':5432') : raw;

async function main() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('Aplicando RLS worker_profiles…');
  await db.query(SQL);
  const { rows } = await db.query(`
    SELECT relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'worker_profiles'
  `);
  await db.end();
  console.log(rows[0]?.relrowsecurity
    ? '✅ worker_profiles RLS activo'
    : '⚠️ worker_profiles sin RLS');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
