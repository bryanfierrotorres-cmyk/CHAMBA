#!/usr/bin/env node
/**
 * Simula postulación de técnico a job open de Mama y verifica RPC cliente.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAMA_JOB_ID = '8541391a-cdb3-4bc1-9658-e96fee295209';
const MAMA_CLIENT_ID = 'cb92c728-f64f-4e9c-9c0b-aef479375e02';

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
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const dbUrl = process.env.SUPABASE_DB_URL;
  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: workers } = await db.query(`
    SELECT id, full_name, phone FROM profiles
    WHERE role::text = 'worker' AND COALESCE(is_approved, false) = true
    ORDER BY full_name LIMIT 5
  `);

  console.log('=== Técnicos aprobados ===');
  for (const w of workers) console.log(`  ${w.full_name} | ${w.id}`);

  const worker = workers.find((w) => w.full_name.includes('Papa')) ?? workers[0];
  if (!worker) {
    console.error('Sin técnico');
    process.exit(1);
  }

  console.log(`\n=== accept_job → Mama open job (${MAMA_JOB_ID.slice(0, 8)}…) ===`);
  console.log(`Técnico: ${worker.full_name}`);

  const { data: before } = await supabase.rpc('get_job_worker_applications', {
    p_job_id: MAMA_JOB_ID,
    p_client_id: MAMA_CLIENT_ID,
  });
  console.log('Apps antes:', before?.applications?.length ?? before?.error);

  const { data: acceptData, error: acceptErr } = await supabase.rpc('accept_job', {
    p_job_id: MAMA_JOB_ID,
    p_worker_id: worker.id,
  });
  console.log('accept_job:', acceptErr?.message ?? JSON.stringify(acceptData));

  const { data: after } = await supabase.rpc('get_job_worker_applications', {
    p_job_id: MAMA_JOB_ID,
    p_client_id: MAMA_CLIENT_ID,
  });
  console.log('Apps después:', after?.applications?.length, after?.applications?.map((a) => a.full_name));

  const { rows: dbApps } = await db.query(
    `SELECT ja.*, p.full_name FROM job_assignments ja JOIN profiles p ON p.id = ja.worker_id WHERE ja.job_id = $1`,
    [MAMA_JOB_ID],
  );
  console.log('BD directa:', dbApps.map((a) => `${a.full_name} (${a.selection_status})`));

  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
