/**
 * ═══════════════════════════════════════════════════════════════════
 * CHAMBA — Script de Caos: Validación del Fallback de Liquidez (073)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Propósito: Probar de extremo a extremo que el motor de asignación
 *            activa el Fallback de Liquidez cuando no hay técnicos de
 *            la categoría exacta y beta_mode = true.
 *
 * Ejecutar: node scripts/chaos-test-073.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { assertTestEnvironment } from './_guard.mjs';

// ─── 0. Carga de variables de entorno (.env) ──────────────────────
function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    console.error('[ENV] Archivo .env no encontrado en:', envPath);
    process.exit(1);
  }
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
assertTestEnvironment('chaos-test-073');

const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON    = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL      = 'admin@chamba.com';
const ADMIN_PASS       = 'Admin1234!';
const WORKER_EMAIL     = 'tecnico@chamba.com';

// Coordenadas del centro de Managua (Rotonda El Güegüense)
const MANAGUA_LAT = 12.1364;
const MANAGUA_LNG = -86.2776;

// El trabajo estará a ~5 km al sur del técnico
// (diferencia de aprox 0.045 grados en latitud ≈ 5 km)
const JOB_LAT = 12.0919;
const JOB_LNG = -86.2776;

// Categorías para el caos
const WORKER_CATEGORY = 'Plomería';      // Lo que sabe el técnico
const JOB_CATEGORY    = 'Cerrajería';    // Lo que pide el cliente (huérfana)

// ─── Colores para la consola ───────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

function log(icon, msg, color = C.reset) {
  console.log(`${color}${C.bold}${icon}${C.reset} ${msg}${C.reset}`);
}
function assert(label, condition) {
  if (condition) {
    console.log(`  ${C.green}✅ PASS${C.reset}  ${label}`);
  } else {
    console.log(`  ${C.red}❌ FAIL${C.reset}  ${label}`);
  }
}

// ─── Helper: pequeña función de haversine (validación local) ──────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Main ──────────────────────────────────────────────────────────
async function runChaosTest() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

  console.log('\n' + '═'.repeat(60));
  console.log(`${C.cyan}${C.bold}  🔥 CHAMBA — Chaos Test 073: Fallback de Liquidez${C.reset}`);
  console.log('═'.repeat(60) + '\n');

  // ─── PASO 0: Login como admin ───────────────────────────────────
  log('🔐', 'Autenticando como administrador…', C.yellow);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  if (authErr) {
    log('💥', `Login fallido: ${authErr.message}`, C.red);
    log('💡', 'Asegúrate de haber ejecutado el script SQL create-test-users.sql en Supabase.', C.gray);
    process.exit(1);
  }
  const adminId = authData.user.id;
  log('✔', `Admin autenticado: ${adminId}\n`, C.green);

  // ─── PASO 1A: Asegurar beta_mode = true ────────────────────────
  log('⚙️ ', 'PASO 1A — Asegurar beta_mode = true en app_config…', C.cyan);
  const { error: betaErr } = await supabase.rpc('set_app_config', {
    p_key: 'beta_mode',
    p_value: 'true',
  });
  if (betaErr) {
    log('⚠️ ', `No se pudo usar la RPC: ${betaErr.message}. Insertando directamente…`, C.yellow);
    await supabase.from('app_config').upsert({ key: 'beta_mode', value: 'true' });
  }
  log('✔', 'beta_mode = true confirmado.\n', C.green);

  // ─── PASO 1B: Configurar técnico de prueba ─────────────────────
  log('🔧', `PASO 1B — Configurando técnico (${WORKER_EMAIL}) para la prueba…`, C.cyan);

  const { data: workerProfile, error: wpErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', WORKER_EMAIL)
    .single();

  if (wpErr || !workerProfile) {
    log('💥', `Técnico no encontrado: ${wpErr?.message}`, C.red);
    log('💡', 'Ejecuta primero el script: supabase/create-test-users.sql', C.gray);
    process.exit(1);
  }
  const workerId = workerProfile.id;
  log('✔', `Worker ID: ${workerId}`, C.green);

  // Asignar SOLO categoría Plomería
  await supabase.from('profiles').update({
    category_1: WORKER_CATEGORY,
    category_2: null,
    is_approved: true,
  }).eq('id', workerId);

  // Poner disponible con GPS en Managua
  const { error: wpUpdateErr } = await supabase.from('worker_profiles').upsert({
    worker_id:           workerId,
    availability_status: 'available',
    last_lat:            MANAGUA_LAT,
    last_lng:            MANAGUA_LNG,
    last_location_at:    new Date().toISOString(),
    acceptance_rate:     1.0,
    completion_rate:     1.0,
  }, { onConflict: 'worker_id' });

  if (wpUpdateErr) {
    log('⚠️ ', `Error al actualizar worker_profiles: ${wpUpdateErr.message}`, C.yellow);
  } else {
    log('✔', `Técnico configurado: categoría="${WORKER_CATEGORY}", lat=${MANAGUA_LAT}, lng=${MANAGUA_LNG}`, C.green);
  }

  const distKm = haversineKm(MANAGUA_LAT, MANAGUA_LNG, JOB_LAT, JOB_LNG);
  log('📍', `Distancia técnico → trabajo: ${distKm.toFixed(2)} km (radio: 15 km)\n`, C.gray);

  // ─── PASO 2: Inyectar solicitud "huérfana" ─────────────────────
  log('🌪️ ', `PASO 2 — Inyectando solicitud huérfana de "${JOB_CATEGORY}"…`, C.cyan);

  const { data: newJob, error: jobErr } = await supabase.from('jobs').insert({
    title:          `[CHAOS TEST] ${JOB_CATEGORY} urgente`,
    description:    'Solicitud de prueba de caos para validar Fallback de Liquidez.',
    category:       JOB_CATEGORY,
    status:         'open',
    booking_type:   'express',
    pay_amount:     500,
    platform_fee:   50,
    worker_payout:  450,
    address:        'Test Location, Managua',
    lat:            JOB_LAT,
    lng:            JOB_LNG,
    urgency_level:  'express',
    duration_hours: 1,
    required_workers: 1,
    slots_taken:    0,
    created_by:     adminId,
  }).select('id, dispatch_data').single();

  if (jobErr || !newJob) {
    log('💥', `Error al insertar job: ${jobErr?.message}`, C.red);
    process.exit(1);
  }

  const jobId = newJob.id;
  log('✔', `Job insertado: ${jobId}`, C.green);
  log('⏳', 'Esperando 1.5s para que el trigger de despacho complete…\n', C.gray);
  await new Promise(r => setTimeout(r, 1500));

  // ─── PASO 3A: Leer dispatch_data actualizado ───────────────────
  log('🔍', 'PASO 3A — Verificando dispatch_data en la tabla jobs…', C.cyan);

  const { data: jobResult } = await supabase
    .from('jobs')
    .select('id, dispatch_data')
    .eq('id', jobId)
    .single();

  const dispatchData = jobResult?.dispatch_data;
  const isFallback   = dispatchData?.is_fallback === true;
  const poolSize     = dispatchData?.pool_size ?? 0;
  const workers      = dispatchData?.workers ?? {};
  const workerIsInPool = workerIsIncluded(workers, workerId);

  // ─── PASO 3B: Verificar evento analítico ──────────────────────
  log('📊', 'PASO 3B — Verificando analytics_events…', C.cyan);

  const { data: events } = await supabase
    .from('analytics_events')
    .select('id, event_name, metadata')
    .eq('event_name', 'dispatch_fallback_activated')
    .contains('metadata', { job_id: jobId })
    .order('created_at', { ascending: false })
    .limit(1);

  const fallbackEventFound = events && events.length > 0;

  // ─── RESULTADOS ────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log(`${C.bold}${C.yellow}  📋 RESULTADOS DEL CHAOS TEST${C.reset}`);
  console.log('─'.repeat(60));

  console.log(`\n  Job ID     : ${C.gray}${jobId}${C.reset}`);
  console.log(`  Categoría  : ${C.red}${JOB_CATEGORY}${C.reset} (sin técnicos especializados)`);
  console.log(`  Pool size  : ${poolSize} técnicos encontrados via fallback`);
  console.log(`  dispatch_data:\n${C.gray}${JSON.stringify(dispatchData, null, 4).split('\n').map(l => '    ' + l).join('\n')}${C.reset}\n`);

  console.log(`${C.bold}  ASERCIONES:${C.reset}`);
  assert(
    `analytics_events tiene un evento 'dispatch_fallback_activated' para este job_id`,
    fallbackEventFound
  );
  assert(
    `dispatch_data contiene "is_fallback": true`,
    isFallback
  );
  assert(
    `El técnico (${WORKER_CATEGORY}) fue incluido en las Waves del JSONB`,
    workerIsInPool
  );

  if (fallbackEventFound) {
    console.log(`\n  ${C.gray}Evento analítico:${C.reset}`);
    console.log(`  ${C.gray}${JSON.stringify(events[0].metadata, null, 2).split('\n').map(l => '  ' + l).join('\n')}${C.reset}`);
  }

  // ─── Limpieza ──────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  log('🧹', 'Limpiando job de prueba…', C.gray);
  await supabase.from('jobs').delete().eq('id', jobId);
  log('✔', 'Job de prueba eliminado.\n', C.green);

  const allPassed = fallbackEventFound && isFallback && workerIsInPool;
  if (allPassed) {
    console.log(`${C.green}${C.bold}  🎉 TODOS LOS TESTS PASARON — Fallback de Liquidez funciona correctamente.${C.reset}`);
  } else {
    console.log(`${C.red}${C.bold}  ⚠️  ALGUNOS TESTS FALLARON — Revisar los logs de arriba.${C.reset}`);
  }
  console.log('\n' + '═'.repeat(60) + '\n');

  await supabase.auth.signOut();
}

/**
 * Verifica si un worker_id aparece como clave en el objeto `workers`
 * del dispatch_data (que es un JSONB plano { uuid: { wave, score } })
 */
function workerIsIncluded(workers, workerId) {
  if (!workers || typeof workers !== 'object') return false;
  return Object.keys(workers).includes(workerId);
}

runChaosTest().catch(err => {
  console.error('\n💥 Error inesperado:', err.message);
  process.exit(1);
});
