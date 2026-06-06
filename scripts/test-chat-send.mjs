#!/usr/bin/env node
/** Prueba send_job_chat_message en un job taken/in_progress con técnico asignado. */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!url || !anon || !dbUrl) {
  console.error('❌ Faltan EXPO_PUBLIC_SUPABASE_URL, ANON_KEY o SUPABASE_DB_URL');
  process.exit(1);
}

async function main() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: jobs } = await db.query(`
    SELECT j.id, j.status, j.created_by, j.assigned_worker_id
    FROM jobs j
    WHERE j.status IN ('taken', 'in_progress')
      AND j.assigned_worker_id IS NOT NULL
    ORDER BY j.updated_at DESC NULLS LAST
    LIMIT 1
  `);

  if (!jobs.length) {
    console.log('⚠️ No hay jobs taken/in_progress con técnico asignado');
    await db.end();
    return;
  }

  const job = jobs[0];
  const workerId = job.assigned_worker_id;
  console.log('Job:', job.id, 'status:', job.status, 'worker:', workerId);

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.rpc('send_job_chat_message', {
    p_servicio_id: job.id,
    p_remitente_id: workerId,
    p_texto: `[test-chat ${new Date().toISOString()}]`,
  });

  if (error) {
    console.error('❌ RPC error:', error.message);
  } else {
    console.log('RPC result:', JSON.stringify(data, null, 2));
  }

  await db.end();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
