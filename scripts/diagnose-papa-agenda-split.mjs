#!/usr/bin/env node
/** Clasificación Activas vs Historial para Papa. npm run diagnose:papa-agenda */
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

const JOB_STATUS = { COMPLETED: 'completed', CANCELLED: 'cancelled', TAKEN: 'taken', IN_PROGRESS: 'in_progress', OPEN: 'open' };
const SELECTION_STATUS = { APPROVED: 'approved', REJECTED: 'rejected', PENDING: 'pending' };
const OPERATIONAL_PHASE = { COMPLETED: 'completed' };

function isWorkerPendingClientSelection(row) {
  const job = row.job;
  if (job?.status !== JOB_STATUS.OPEN) return false;
  const selection = row.selection_status;
  if (selection === SELECTION_STATUS.REJECTED) return false;
  return !selection || selection === SELECTION_STATUS.PENDING;
}

function isWorkerCommitmentActive(row) {
  const job = row.job;
  if (!job?.id) return false;
  const status = job.status;
  if (status === JOB_STATUS.COMPLETED || status === JOB_STATUS.CANCELLED) return false;
  const selection = row.selection_status;
  if (selection === SELECTION_STATUS.REJECTED) return false;
  const isAssigned = job.assigned_worker_id != null && job.assigned_worker_id === row.worker_id;
  if (status === JOB_STATUS.OPEN) {
    return selection === SELECTION_STATUS.PENDING && (job.assigned_worker_id == null || isAssigned);
  }
  if (status === JOB_STATUS.IN_PROGRESS) {
    return isAssigned && (selection === SELECTION_STATUS.APPROVED || selection == null);
  }
  if (status === JOB_STATUS.TAKEN) {
    return isAssigned && selection === SELECTION_STATUS.APPROVED && job.operational_phase !== OPERATIONAL_PHASE.COMPLETED;
  }
  return false;
}

function isWorkerAssignmentActive(job) {
  const status = job?.status;
  if (!status) return false;
  return status === JOB_STATUS.TAKEN || status === JOB_STATUS.IN_PROGRESS;
}

function isWorkerAssignmentHistory(job) {
  const status = job?.status;
  return status === JOB_STATUS.COMPLETED || status === JOB_STATUS.CANCELLED;
}

function isWorkerAgendaActive(row) {
  const status = row.job?.status;
  if (status === JOB_STATUS.COMPLETED || status === JOB_STATUS.CANCELLED) {
    const phase = row.job?.operational_phase;
    if (status === JOB_STATUS.COMPLETED && phase && phase !== OPERATIONAL_PHASE.COMPLETED) {
      return true;
    }
    return false;
  }
  if (row.selection_status === SELECTION_STATUS.REJECTED) return false;
  if (status === JOB_STATUS.TAKEN || status === JOB_STATUS.IN_PROGRESS) {
    return row.selection_status === SELECTION_STATUS.APPROVED || row.job?.assigned_worker_id === row.worker_id;
  }
  if (isWorkerCommitmentActive(row) || isWorkerAssignmentActive(row.job)) return true;
  return isWorkerPendingClientSelection(row);
}

function isWorkerAgendaHistory(row) {
  return isWorkerAssignmentHistory(row.job) && !isWorkerAgendaActive(row);
}

function classify(row) {
  if (isWorkerAgendaHistory(row)) return 'historial';
  if (isWorkerAgendaActive(row)) return 'activas';
  return 'oculto';
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const sb = createClient(url, anon, { auth: { persistSession: false } });

  const { data: rpcRows, error } = await sb.rpc('get_worker_agenda_panel', { p_worker_id: PEPE_ID });
  if (error) {
    console.error('RPC error:', error.message);
    process.exit(1);
  }

  const rows = Array.isArray(rpcRows) ? rpcRows : [];
  const buckets = { activas: [], historial: [], oculto: [] };

  for (const row of rows) {
    const bucket = classify(row);
    buckets[bucket].push(row);
  }

  console.log('\n=== Papa — clasificación Activas / Historial (misma lógica que la app) ===\n');
  console.log(`Total RPC: ${rows.length} | Activas: ${buckets.activas.length} | Historial: ${buckets.historial.length} | Oculto: ${buckets.oculto.length}\n`);

  for (const [name, list] of Object.entries(buckets)) {
    if (!list.length) continue;
    console.log(`--- ${name.toUpperCase()} (${list.length}) ---`);
    for (const r of list) {
      const j = r.job ?? {};
      console.log({
        title: j.title,
        job_status: j.status,
        operational_phase: j.operational_phase,
        selection_status: r.selection_status,
        assigned_worker_id: j.assigned_worker_id,
        completed_at: r.completed_at,
      });
    }
    console.log('');
  }

  const pg = await import('pg');
  const db = new pg.default.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const { rows: allAssign } = await db.query(
    `SELECT ja.selection_status, ja.completed_at, j.title, j.status, j.operational_phase, j.assigned_worker_id
     FROM job_assignments ja
     JOIN jobs j ON j.id = ja.job_id
     WHERE ja.worker_id = $1
     ORDER BY ja.assigned_at DESC`,
    [PEPE_ID],
  );

  console.log('=== TODAS las asignaciones en BD (sin filtro RPC) ===\n');
  for (const r of allAssign) {
    console.log(r);
  }

  const { rows: completedOnly } = await db.query(
    `SELECT j.title, j.status, j.operational_phase, ja.completed_at
     FROM job_assignments ja
     JOIN jobs j ON j.id = ja.job_id
     WHERE ja.worker_id = $1 AND j.status IN ('completed', 'cancelled')`,
    [PEPE_ID],
  );
  console.log(`\nCompletadas/canceladas en BD: ${completedOnly.length}`);
  for (const r of completedOnly) console.log(r);

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
