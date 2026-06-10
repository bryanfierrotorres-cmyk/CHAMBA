#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PEPE_ID = '43ce7eec-c77a-497a-a1d1-99e0946b83f8';

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

async function main() {
  const pg = await import('pg');
  const db = new pg.default.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const { rows: [def] } = await db.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_worker_assignments'
    LIMIT 1
  `);
  const hasPhoneLogin = def?.def?.includes('auth.uid() IS NOT NULL');
  console.log('Función incluye guard auth.uid():', hasPhoneLogin ? 'SÍ (045)' : 'NO (vieja)');

  const { rows: [rpc] } = await db.query(
    `SELECT jsonb_array_length(get_worker_assignments($1::uuid)) AS n`,
    [PEPE_ID],
  );
  console.log('SQL directo get_worker_assignments(Pepe):', rpc?.n, 'filas');

  const { rows: active } = await db.query(
    `
    SELECT j.title, j.status, ja.selection_status
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.worker_id = $1
      AND j.status IN ('taken','in_progress','open')
    ORDER BY ja.assigned_at DESC
    `,
    [PEPE_ID],
  );
  console.log('\nActivas en BD:');
  for (const r of active) console.log(`  ${r.status} | ${r.selection_status} | ${r.title}`);

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
