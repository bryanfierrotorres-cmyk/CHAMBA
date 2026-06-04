#!/usr/bin/env node
/**
 * Aplica 018_jobs_operational_phase_for_approve.sql
 * npm run db:apply-approve-fix
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = '018_jobs_operational_phase_for_approve.sql';

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
  console.log(`Aplicando ${MIGRATION}…`);
  await client.query(readFileSync(join(ROOT, 'supabase', 'migrations', MIGRATION), 'utf8'));

  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'jobs'
      AND column_name IN ('operational_phase', 'assigned_worker_id')
  `);
  const { rows: rpc } = await client.query(`
    SELECT proname FROM pg_proc WHERE proname = 'client_approve_worker_application'
  `);

  await client.end();
  console.log('✅ Migración aplicada.');
  console.log('   Columnas:', cols.map((r) => r.column_name).join(', ') || '(ninguna)');
  console.log('   RPC approve:', rpc.length > 0 ? 'OK' : 'NO');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
