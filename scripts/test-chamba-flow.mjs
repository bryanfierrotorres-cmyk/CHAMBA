#!/usr/bin/env node
/**
 * CHAMBA — Prueba E2E Cliente → Admin → Colaborador
 *
 * .env requerido:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Opcional (aplica migración automática antes del test):
 *   SUPABASE_DB_URL
 *
 * npm run test:chamba-flow
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  CHAMBA_CATEGORY_IDS,
  getWorkerApprovedCategories,
  canWorkerSeeJobCategory,
} from './workerCategoryAccess.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Requiere EXPO_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RUN_ID = Date.now().toString(36);
const CAT_SOFA = 'limpieza_sofas';
const CAT_GARDEN = 'jardineria';
const TEST_PASSWORD = 'ChambaTest123!';

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const log = (step, msg) => console.log(`\n[${step}] ${msg}`);

async function applyMigrationIfPossible() {
  if (!process.env.SUPABASE_DB_URL && !process.env.DATABASE_URL) return;
  log('0', 'Aplicando migración 005 en la base de datos…');
  const r = spawnSync(process.execPath, [join(__dirname, 'apply-chamba-schema.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) throw new Error('No se pudo aplicar la migración (db:sync-chamba)');
}

async function createAuthUser(email, fullName, role) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw new Error(`auth.createUser(${email}): ${error.message}`);
  return data.user;
}

async function waitProfile(userId, retries = 8) {
  for (let i = 0; i < retries; i++) {
    const { data } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) return data;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Perfil no creado para ${userId} (revisa trigger fn_handle_new_user)`);
}

async function updateProfile(id, patch) {
  const { data, error } = await admin.from('profiles').update(patch).eq('id', id).select().single();
  if (error) throw new Error(`profiles.update: ${error.message}`);
  return data;
}

async function createClientJob(createdBy, payload) {
  const { data, error } = await admin.rpc('create_client_job', {
    p_created_by:       createdBy,
    p_title:            payload.title,
    p_description:      payload.description,
    p_category:         payload.category,
    p_pay_amount:       payload.payAmount,
    p_address:          payload.address,
    p_lat:              payload.lat,
    p_lng:              payload.lng,
    p_duration_hours:   payload.durationHours,
    p_required_workers: payload.requiredWorkers,
    p_media_urls:       [],
  });

  if (error) throw new Error(`create_client_job RPC: ${error.message}`);
  const result = data;
  if (!result?.success) throw new Error(result?.error ?? 'create_client_job falló');
  return result.job;
}

async function cleanup(ids, jobId) {
  if (jobId) await admin.from('jobs').delete().eq('id', jobId);
  for (const id of ids) {
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  CHAMBA — Prueba E2E Cliente / Admin / Colaborador');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Run ID: ${RUN_ID}`);

  await applyMigrationIfPossible();

  assert(CHAMBA_CATEGORY_IDS.length === 8, 'Deben existir 8 categorías oficiales');

  const clientEmail = `client-${RUN_ID}@chamba-test.app`;
  const workerEmail = `worker-${RUN_ID}@chamba-test.app`;
  let jobId = null;
  let clientId = null;
  let workerId = null;

  try {
    // ── Paso 1: Cliente + solicitud Sofás ───────────────────────────────────
    log('1', 'Cliente publica solicitud de Limpieza de Sofás');

    const clientUser = await createAuthUser(clientEmail, `Cliente Test ${RUN_ID}`, 'client');
    clientId = clientUser.id;
    let client = await waitProfile(clientId);
    client = await updateProfile(clientId, { phone: `88${RUN_ID.slice(0, 6)}`, is_approved: true, role: 'client' });

    const job = await createClientJob(clientId, {
      title:           `Test Sofás ${RUN_ID}`,
      description:     'Solicitud E2E — limpieza de sofás.',
      category:        CAT_SOFA,
      payAmount:       1400,
      address:         'Managua, Nicaragua',
      lat:             12.1364,
      lng:             -86.2514,
      durationHours:   3,
      requiredWorkers: 1,
    });
    jobId = job.id;
    assert(job.category === CAT_SOFA, `Categoría del job debe ser ${CAT_SOFA}`);
    log('1', `✓ Job creado id=${jobId}`);

    // ── Paso 2: Colaborador bloqueado ──────────────────────────────────────
    log('2', 'Colaborador con cat.2 = Sofás sin aprobación admin');

    const workerUser = await createAuthUser(workerEmail, `Técnico Test ${RUN_ID}`, 'worker');
    workerId = workerUser.id;
    await waitProfile(workerId);

    let worker = await updateProfile(workerId, {
      phone:               `87${RUN_ID.slice(0, 6)}`,
      is_approved:         false,
      worker_status:       'pending_approval',
      cedula_url:          `https://test.chamba/${RUN_ID}/cedula.jpg`,
      record_policia_url:  `https://test.chamba/${RUN_ID}/record.jpg`,
      category_1:          CAT_GARDEN,
      category_2:            CAT_SOFA,
      category_1_approved:   true,
      category_2_approved:   false,
    });

    assert(!canWorkerSeeJobCategory(worker, CAT_SOFA), 'NO debe ver limpieza_sofas aún');
    assert(getWorkerApprovedCategories(worker).length === 0, 'Feed vacío sin aprobación general');
    log('2', '✓ Feed bloqueado correctamente');

    // ── Paso 3: Admin aprueba ─────────────────────────────────────────────
    log('3', 'Admin aprueba colaborador y 2ª categoría');

    worker = await updateProfile(workerId, {
      is_approved:         true,
      worker_status:       'active',
      category_1_approved: true,
      category_2_approved: true,
    });

    // ── Paso 4: Colaborador ve la oferta ──────────────────────────────────
    log('4', 'Verificar oferta visible en feed del colaborador');

    assert(canWorkerSeeJobCategory(worker, CAT_SOFA), 'Debe ver limpieza_sofas tras aprobación');

    const approvedCats = getWorkerApprovedCategories(worker);
    const { data: feedJobs, error: feedErr } = await admin
      .from('jobs')
      .select('id, category, status')
      .eq('status', 'open')
      .in('category', approvedCats);

    if (feedErr) throw new Error(feedErr.message);
    assert((feedJobs ?? []).some((j) => j.id === jobId), 'La oferta debe estar en el feed filtrado');

    log('4', `✓ Oferta visible (${feedJobs?.length ?? 0} jobs en categorías aprobadas)`);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  [CHAMBA CONECTADA CON ÉXITO]');
    console.log('═══════════════════════════════════════════════════\n');
  } finally {
    if (clientId && workerId) {
      await cleanup([clientId, workerId], jobId);
      console.log('(Datos de prueba eliminados)\n');
    }
  }
}

main().catch((err) => {
  console.error('\n❌ PRUEBA FALLIDA:', err.message);
  if (err.message.includes('create_client_job') || err.message.includes('enum')) {
    console.error('\n→ Ejecuta: npm run db:sync-chamba');
    console.error('   (necesitas SUPABASE_DB_URL en .env)');
  }
  process.exit(1);
});
