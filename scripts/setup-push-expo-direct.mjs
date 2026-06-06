#!/usr/bin/env node
/**
 * Push directo INSERT jobs → Expo API (pg_net).
 * No requiere desplegar Edge Functions ni SUPABASE_ACCESS_TOKEN.
 * Requiere SUPABASE_DB_URL en .env
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = '033_jobs_push_expo_direct.sql';

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

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ SUPABASE_DB_URL en .env');
  process.exit(1);
}

async function main() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(readFileSync(join(ROOT, 'supabase', 'migrations', MIGRATION), 'utf8'));

  const { rows } = await client.query(`
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'chamba_notify_workers_expo_push'
  `);

  await client.end();

  if (rows.length === 0) {
    console.error('❌ Función chamba_notify_workers_expo_push no encontrada');
    process.exit(1);
  }

  console.log('✅ Push directo activo: INSERT jobs → Expo (sin Edge Functions)');
  console.log('   Trigger: jobs_insert_notify_workers');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
