#!/usr/bin/env node
/** Cliente vs técnico: mismos jobs, distinto status? npm run diagnose:client-worker-sync */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

function clientBucket(job) {
  if (job.status === 'completed' || job.status === 'cancelled') return 'historial';
  if (job.status === 'taken' || job.status === 'in_progress') return 'activas';
  if (job.status === 'open' && job.assigned_worker_id) return 'activas';
  return 'pendientes';
}

function workerBucket(job) {
  if (job.status === 'completed' || job.status === 'cancelled') return 'historial';
  if (job.status === 'taken' || job.status === 'in_progress') return 'activas';
  return 'oculto';
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const sb = createClient(url, anon, { auth: { persistSession: false } });

  const pg = await import('pg');
  const db = new pg.default.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const { rows: jobs } = await db.query(
    `SELECT j.id, j.title, j.status, j.operational_phase, j.created_by, j.assigned_worker_id,
            p.full_name AS client_name, p.phone AS client_phone
     FROM jobs j
     JOIN job_assignments ja ON ja.job_id = j.id AND ja.worker_id = $1
     LEFT JOIN profiles p ON p.id = j.created_by
     WHERE ja.selection_status = 'approved'
     ORDER BY j.updated_at DESC`,
    [PEPE_ID],
  );

  console.log('\n=== Papa — jobs BD vs clasificación cliente/técnico ===\n');
  const mismatches = [];

  for (const j of jobs) {
    const w = workerBucket(j);
    const c = clientBucket(j);
    const row = {
      title: j.title,
      status: j.status,
      phase: j.operational_phase,
      client: `${j.client_name} (${j.client_phone})`,
      worker_tab: w,
      client_tab: c,
      sync_ok: w === c || (w === 'historial' && c === 'historial') || (w === 'activas' && c === 'activas'),
    };
    console.log(row);
    if (!row.sync_ok) mismatches.push(row);
  }

  console.log(`\nDesincronizados: ${mismatches.length}`);

  const clientIds = [...new Set(jobs.map((j) => j.created_by).filter(Boolean))];
  console.log(`\n=== Vista RPC cliente (get_client_orders_panel) ===\n`);

  for (const clientId of clientIds) {
    const { data: panel, error } = await sb.rpc('get_client_orders_panel', {
      p_client_id: clientId,
    });
    if (error) {
      console.error('panel error', clientId, error.message);
      continue;
    }
    const rows = Array.isArray(panel) ? panel : [];
    const pepeJobs = rows.filter((r) => r.assigned_worker_id === PEPE_ID);
    const clientProfile = jobs.find((j) => j.created_by === clientId);
    console.log(`Cliente ${clientProfile?.client_name} (${clientProfile?.client_phone}):`);
    for (const r of pepeJobs) {
      console.log({
        title: r.title,
        status: r.status,
        phase: r.operational_phase,
        tab: clientBucket(r),
      });
    }
    console.log('');
  }

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
