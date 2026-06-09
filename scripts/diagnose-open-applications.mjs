#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
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

  const { rows: openJobs } = await db.query(`
    SELECT j.id, j.title, j.status, p.full_name AS client, j.created_at
    FROM jobs j JOIN profiles p ON p.id = j.created_by
    WHERE j.status = 'open' ORDER BY j.created_at DESC
  `);
  console.log('OPEN JOBS:');
  for (const j of openJobs) {
    const { rows: apps } = await db.query(
      `SELECT COUNT(*)::int AS n FROM job_assignments WHERE job_id = $1 AND selection_status = 'pending'`,
      [j.id],
    );
    console.log(`  ${j.title} | ${j.client} | pending: ${apps[0].n} | ${j.id}`);
  }

  const { rows: recentApps } = await db.query(`
    SELECT ja.assigned_at, ja.selection_status, p.full_name AS worker, j.title, cp.full_name AS client, j.status
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    JOIN profiles p ON p.id = ja.worker_id
    JOIN profiles cp ON cp.id = j.created_by
    ORDER BY ja.assigned_at DESC LIMIT 20
  `);
  console.log('\nRECENT APPLICATIONS:');
  for (const a of recentApps) {
    console.log(`  ${a.assigned_at} | ${a.selection_status} | ${a.worker} -> ${a.title} (${a.client}, ${a.status})`);
  }

  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
