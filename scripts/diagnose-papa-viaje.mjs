#!/usr/bin/env node
/** Diagnóstico: fase operativa Papa — agenda + advance RPC. npm run diagnose:papa-viaje */
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

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const sb = createClient(url, anon, { auth: { persistSession: false } });

  const { data: rows, error } = await sb.rpc('get_worker_agenda_panel', {
    p_worker_id: PEPE_ID,
  });
  if (error) {
    console.error('agenda RPC error:', error.message);
    process.exit(1);
  }

  const list = Array.isArray(rows) ? rows : [];
  const active = list.filter((r) => ['taken', 'in_progress'].includes(r.job?.status));

  console.log('\n=== Chambas activas Papa (taken/in_progress) ===\n');
  for (const r of active) {
    const j = r.job ?? {};
    console.log({
      assignment_id: r.id,
      job_id: r.job_id,
      worker_id: r.worker_id,
      selection_status: r.selection_status,
      job_status: j.status,
      operational_phase: j.operational_phase,
      assigned_worker_id: j.assigned_worker_id,
      title: j.title,
      match: j.assigned_worker_id === r.worker_id,
    });
  }

  const target = active.find((r) => r.job?.operational_phase === 'accepted' || r.job?.status === 'taken');
  if (!target) {
    console.log('\nNo hay job taken con fase accepted para probar advance.');
    return;
  }

  const jobId = target.job_id;
  console.log(`\n=== Probar worker_advance_operational_phase → en_route (${target.job?.title}) ===\n`);

  const { data: adv, error: advErr } = await sb.rpc('worker_advance_operational_phase', {
    p_job_id: jobId,
    p_worker_id: PEPE_ID,
    p_phase: 'en_route',
  });
  console.log('RPC result:', advErr?.message ?? adv);

  if (adv?.success) {
    console.log('\nRevertir a accepted para no alterar demo…');
    await sb.rpc('worker_advance_operational_phase', {
      p_job_id: jobId,
      p_worker_id: PEPE_ID,
      p_phase: 'accepted',
    });
  }

  const pg = await import('pg');
  const db = new pg.default.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  const { rows: authRows } = await db.query(
    `SELECT id, email FROM auth.users WHERE email ILIKE '%84888888%' OR id = $1`,
    [PEPE_ID],
  );
  console.log('\nauth.users Papa:', authRows);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
