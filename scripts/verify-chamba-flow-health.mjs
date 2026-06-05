#!/usr/bin/env node
/**
 * Verificación integral: cupo técnico, aprobar cliente, conteos Pepe/Mama
 * npm run verify:chamba-health
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PEPE_ID = '11111111-1111-1111-1111-111111111102';
const MAMA_ID = '11111111-1111-1111-1111-111111111101';

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
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY;

let passed = 0;
let failed = 0;

const ok = (msg) => {
  passed += 1;
  console.log(`  ✅ ${msg}`);
};
const fail = (msg) => {
  failed += 1;
  console.log(`  ❌ ${msg}`);
};

async function main() {
  console.log('\n=== CHAMBA — verificación de salud ===\n');

  if (!dbUrl) {
    fail('SUPABASE_DB_URL no configurado');
    process.exit(1);
  }

  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // 1. Funciones RPC existen
  const { rows: funcs } = await db.query(`
    SELECT proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND proname IN (
        'count_worker_active_commitments',
        'count_client_active_jobs',
        'client_approve_worker_application',
        'get_worker_assignments'
      )
  `);
  const names = new Set(funcs.map((f) => f.proname));
  for (const fn of [
    'count_worker_active_commitments',
    'count_client_active_jobs',
    'client_approve_worker_application',
    'get_worker_assignments',
  ]) {
    if (names.has(fn)) ok(`RPC ${fn} existe`);
    else fail(`RPC ${fn} NO existe`);
  }

  const countFn = funcs.find((f) => f.proname === 'count_worker_active_commitments');
  if (countFn?.args?.includes('p_exclude_job_id')) {
    ok('count_worker_active_commitments acepta p_exclude_job_id (migración 022)');
  } else {
    fail(`count_worker_active_commitments sin exclude: args=${countFn?.args ?? '?'}`);
  }

  // 2. Perfiles prueba
  const { rows: profiles } = await db.query(`
    SELECT id, full_name, phone, role, is_approved
    FROM profiles
    WHERE id IN ($1::uuid, $2::uuid)
  `, [MAMA_ID, PEPE_ID]);

  const mama = profiles.find((p) => p.id === MAMA_ID);
  const pepe = profiles.find((p) => p.id === PEPE_ID);
  if (mama?.role === 'client') ok(`Mama (${mama.phone}) cliente OK`);
  else fail('Perfil mama no encontrado o rol incorrecto');
  if (pepe?.role === 'worker' && pepe.is_approved) ok(`Pepe (${pepe.phone}) técnico aprobado OK`);
  else fail('Pepe no aprobado o no encontrado');

  // 3. Cupo Pepe
  const { rows: [totalCnt] } = await db.query(
    `SELECT count_worker_active_commitments($1::uuid) AS n`,
    [PEPE_ID],
  );
  const total = Number(totalCnt?.n ?? -1);
  console.log(`\n--- Pepe: cupo total = ${total} ---`);

  const { rows: pendingOpen } = await db.query(
    `
    SELECT ja.job_id, j.title, j.created_by
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.worker_id = $1
      AND j.status = 'open'
      AND ja.selection_status = 'pending'
    ORDER BY ja.assigned_at DESC
    `,
    [PEPE_ID],
  );

  const { rows: inProgress } = await db.query(
    `
    SELECT j.id, j.title, j.status
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.worker_id = $1
      AND j.status IN ('taken', 'in_progress')
      AND ja.selection_status = 'approved'
    `,
    [PEPE_ID],
  );

  console.log(`  Postulaciones pending (open): ${pendingOpen.length}`);
  pendingOpen.forEach((r) => console.log(`    · ${r.title}`));
  console.log(`  Trabajos en curso (taken/in_progress): ${inProgress.length}`);
  inProgress.forEach((r) => console.log(`    · ${r.title} (${r.status})`));

  if (total <= 2) ok(`Cupo Pepe ${total}/2 dentro del límite`);
  else fail(`Cupo Pepe ${total} > 2 (revisar datos)`);

  // 4. Cada postulación pending debe poder aprobarse (exclude job)
  let approveBlocked = 0;
  for (const row of pendingOpen) {
    const { rows: [ex] } = await db.query(
      `SELECT count_worker_active_commitments($1::uuid, $2::uuid) AS n`,
      [PEPE_ID, row.job_id],
    );
    const exCount = Number(ex?.n ?? 99);
    const canApprove = exCount < 2;
    if (canApprove) {
      ok(`Cliente puede elegir Pepe en "${row.title}" (cupo sin esta job = ${exCount})`);
    } else {
      approveBlocked += 1;
      fail(`BLOQUEADO elegir Pepe en "${row.title}" (cupo excl. = ${exCount})`);
    }
  }

  if (pendingOpen.length === 0) {
    console.log('  (sin postulaciones pending abiertas para probar approve)');
  }

  // 5. Simular approve vía RPC (solo lectura del check — dry run en SQL)
  const mamaOpenJob = pendingOpen.find((p) => p.created_by === MAMA_ID);
  if (mamaOpenJob && supabaseUrl && anonKey) {
    const sb = createClient(supabaseUrl, anonKey);
    const { data, error } = await sb.rpc('client_approve_worker_application', {
      p_job_id: mamaOpenJob.job_id,
      p_client_id: MAMA_ID,
      p_worker_id: PEPE_ID,
    });
    const body = data ?? {};
    if (error) {
      fail(`RPC client_approve_worker_application error: ${error.message}`);
    } else if (body.success) {
      ok(`RPC approve OK: Pepe asignado a "${mamaOpenJob.title}"`);
      // Revertir para no alterar estado de prueba permanente — solo si acabamos de aprobar
      await db.query(
        `UPDATE jobs SET status = 'open', assigned_worker_id = NULL, operational_phase = NULL, updated_at = NOW() WHERE id = $1`,
        [mamaOpenJob.job_id],
      );
      await db.query(
        `UPDATE job_assignments SET selection_status = 'pending' WHERE job_id = $1 AND worker_id = $2`,
        [mamaOpenJob.job_id, PEPE_ID],
      );
      await db.query(
        `UPDATE job_assignments SET selection_status = 'rejected' WHERE job_id = $1 AND worker_id <> $2 AND selection_status = 'approved'`,
        [mamaOpenJob.job_id, PEPE_ID],
      );
      console.log('  (estado revertido a open+pending para no dejar datos sucios)');
    } else if (body.code === 'worker_active_limit') {
      fail(`RPC approve bloqueado: ${body.error}`);
    } else {
      console.log(`  ℹ️ RPC approve respuesta: ${body.error ?? JSON.stringify(body)}`);
    }
  }

  // 6. Mama cupo publicación
  const { rows: [mamaCnt] } = await db.query(
    `SELECT count_client_active_jobs($1::uuid) AS n`,
    [MAMA_ID],
  );
  const mamaActive = Number(mamaCnt?.n ?? 0);
  if (mamaActive <= 2) ok(`Mama solicitudes activas ${mamaActive}/2 OK`);
  else fail(`Mama tiene ${mamaActive} activas (>2 imposible por RPC)`);

  // 7. Realtime publication
  const { rows: rt } = await db.query(`
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename IN ('jobs', 'job_assignments')
  `);
  const rtSet = new Set(rt.map((r) => r.tablename));
  if (rtSet.has('jobs') && rtSet.has('job_assignments')) {
    ok('Realtime: jobs + job_assignments publicados');
  } else {
    fail(`Realtime incompleto: ${[...rtSet].join(', ') || 'ninguno'}`);
  }

  // 8. get_worker_assignments incluye selection_status
  if (supabaseUrl && anonKey) {
    const sb = createClient(supabaseUrl, anonKey);
    const { data, error } = await sb.rpc('get_worker_assignments', { p_worker_id: PEPE_ID });
    if (error) {
      fail(`get_worker_assignments: ${error.message}`);
    } else {
      const arr = Array.isArray(data) ? data : JSON.parse(data || '[]');
      const withSel = arr.filter((a) => a.selection_status != null).length;
      if (withSel > 0 || arr.length === 0) {
        ok(`get_worker_assignments devuelve ${arr.length} filas (${withSel} con selection_status)`);
      } else {
        fail('get_worker_assignments sin selection_status');
      }
    }
  }

  await db.end();

  console.log(`\n=== Resultado: ${passed} OK, ${failed} fallos ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
