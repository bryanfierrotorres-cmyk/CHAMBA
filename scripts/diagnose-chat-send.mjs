#!/usr/bin/env node
/** Diagnóstico chat: jobs elegibles, RPC, permisos can_write por cliente/técnico. */
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

async function main() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: fnRows } = await db.query(`
    SELECT p.proname,
           pg_get_functiondef(p.oid) LIKE '%row_security = off%' AS has_row_security_off
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('send_job_chat_message', 'job_chat_user_can_write')
  `);
  console.log('\n=== Funciones RPC ===');
  console.table(fnRows);

  const { rows: jobs } = await db.query(`
    SELECT j.id, j.title, j.status, j.created_by, j.assigned_worker_id,
           pc.full_name AS client_name, pw.full_name AS worker_name
    FROM jobs j
    LEFT JOIN profiles pc ON pc.id = j.created_by
    LEFT JOIN profiles pw ON pw.id = j.assigned_worker_id
    WHERE j.status IN ('taken', 'in_progress', 'open', 'completed')
    ORDER BY j.updated_at DESC NULLS LAST
    LIMIT 8
  `);
  console.log('\n=== Jobs recientes ===');
  for (const j of jobs) {
    const { rows: cw } = await db.query(
      `SELECT job_chat_user_can_write($1::uuid, $2::uuid) AS client_can_write,
              job_chat_user_can_write($1::uuid, $3::uuid) AS worker_can_write`,
      [j.id, j.created_by, j.assigned_worker_id],
    );
    console.log({
      id: j.id.slice(0, 8),
      status: j.status,
      client: j.client_name,
      worker: j.worker_name ?? '(sin asignar)',
      assigned_worker_id: j.assigned_worker_id?.slice(0, 8) ?? null,
      client_can_write: j.created_by ? cw[0]?.client_can_write : null,
      worker_can_write: j.assigned_worker_id ? cw[0]?.worker_can_write : null,
    });
  }

  const active = jobs.find((j) =>
    ['taken', 'in_progress'].includes(j.status) && j.assigned_worker_id,
  );

  if (!url || !anon) {
    console.log('\n⚠️ Sin URL/anon key — omitiendo prueba RPC HTTP');
    await db.end();
    return;
  }

  const supabase = createClient(url, anon);

  if (active) {
    console.log('\n=== Prueba RPC (anon, sin JWT) ===');
    for (const [role, uid] of [
      ['cliente', active.created_by],
      ['técnico', active.assigned_worker_id],
    ]) {
      const { data, error } = await supabase.rpc('send_job_chat_message', {
        p_servicio_id: active.id,
        p_remitente_id: uid,
        p_texto: `[diag ${role} ${Date.now()}]`,
      });
      console.log(role, error?.message ?? data);
    }
  } else {
    console.log('\n⚠️ No hay job taken/in_progress con técnico para probar RPC');
  }

  // Perfiles piloto comunes
  const { rows: pilots } = await db.query(`
    SELECT id, full_name, phone, role FROM profiles
    WHERE phone IN ('88888888', '77777777', '50588888888')
       OR full_name ILIKE '%pepe%' OR full_name ILIKE '%marcela%'
    LIMIT 10
  `);
  console.log('\n=== Perfiles piloto / test ===');
  console.table(pilots);

  await db.end();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
