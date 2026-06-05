#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PEPE_ID = '11111111-1111-1111-1111-111111111102';

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
  console.error('SUPABASE_DB_URL required');
  process.exit(1);
}

async function main() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: [pepe] } = await db.query(
    `SELECT id, full_name, phone FROM profiles WHERE phone = '84888888' OR id = $1 LIMIT 1`,
    [PEPE_ID],
  );
  const workerId = pepe?.id ?? PEPE_ID;
  console.log('Pepe:', pepe);

  const { rows: [cnt] } = await db.query(
    `SELECT count_worker_active_commitments($1::uuid) AS n`,
    [workerId],
  );
  console.log('\ncount_worker_active_commitments:', cnt?.n);

  const { rows: openPending } = await db.query(
    `
    SELECT ja.job_id, j.title
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.worker_id = $1
      AND j.status = 'open'
      AND ja.selection_status = 'pending'
    ORDER BY ja.assigned_at DESC
    `,
    [workerId],
  );

  for (const row of openPending) {
    const { rows: [ex] } = await db.query(
      `SELECT count_worker_active_commitments($1::uuid, $2::uuid) AS n`,
      [workerId, row.job_id],
    );
    console.log(`  excluyendo "${row.title}": cupo=${ex?.n} (cliente puede elegir si < 2)`);
  }

  const { rows: assigns } = await db.query(
    `
    SELECT
      ja.id AS assignment_id,
      ja.job_id,
      ja.selection_status,
      ja.assigned_at,
      j.title,
      j.status AS job_status,
      j.created_by
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.worker_id = $1
    ORDER BY ja.assigned_at DESC
    `,
    [workerId],
  );

  console.log('\nTodas las asignaciones de Pepe:');
  for (const a of assigns) {
    const counts =
      (a.job_status === 'open' && a.selection_status === 'pending')
      || (['taken', 'in_progress'].includes(a.job_status) && a.selection_status === 'approved');
    console.log(`  [${counts ? 'CUENTA' : 'no cuenta'}] ${a.selection_status} | job=${a.job_status} | ${a.title}`);
  }

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
