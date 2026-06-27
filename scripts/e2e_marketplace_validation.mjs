/**
 * ═══════════════════════════════════════════════════════════════════════
 * CHAMBA — Suite E2E Nivel 2: Validación del Marketplace Engine
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CASO 5: Race Condition (Concurrencia en la asignación)
 * CASO 6: Fuera de Radio (Filtro Geométrico Haversine)
 * CASO 8: Técnico Offline (Filtro de Estado)
 *
 * Ejecutar: node scripts/e2e_marketplace_validation.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { assertTestEnvironment } from './_guard.mjs';

function loadEnv() {
  const p = join(process.cwd(), '.env');
  if (!existsSync(p)) { console.error('[ENV] .env no encontrado'); process.exit(1); }
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
assertTestEnvironment('e2e_marketplace_validation');

const sbAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
const sbWorker = sbAdmin;

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m',
};

let totalPass = 0, totalFail = 0;
const failLog = [];
const jobsToClean = [];

function title(n, label) {
  console.log(`\n${C.cyan}${C.bold}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  CASO ${n}: ${label}${C.reset}`);
  console.log(`${C.cyan}${'═'.repeat(60)}${C.reset}`);
}
function step(msg) { console.log(`${C.gray}  ▸ ${msg}${C.reset}`); }
function warn(msg) { console.log(`  ${C.yellow}⚠️  ${msg}${C.reset}`); }
function assert(label, condition, detail = '') {
  if (condition) {
    totalPass++;
    console.log(`  ${C.green}✅ PASS${C.reset}  ${label}`);
  } else {
    totalFail++;
    failLog.push(`FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    console.log(`  ${C.red}❌ FAIL${C.reset}  ${label}${detail ? C.gray + ' (' + detail + ')' + C.reset : ''}`);
  }
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function insertJob(adminId, overrides = {}) {
  const { data, error } = await sbAdmin.from('jobs').insert({
    title: `[E2E MP] Test Job ${Date.now()}`,
    description: 'Prueba E2E Marketplace',
    category: 'Plomería',
    status: 'open',
    booking_type: 'express',
    pay_amount: 300, platform_fee: 15, worker_payout: 285,
    address: 'Test, Managua',
    lat: 12.1364, lng: -86.2776,
    urgency_level: 'express', duration_hours: 1, required_workers: 1, slots_taken: 0,
    created_by: adminId,
    ...overrides,
  }).select('id, dispatch_data, status').single();
  if (error) throw new Error(`insertJob failed: ${error.message}`);
  return data;
}

async function cleanupJobs(ids) {
  if (!ids.length) return;
  await sbAdmin.from('job_assignments').delete().in('job_id', ids);
  await sbAdmin.from('analytics_events').delete().filter('metadata->job_id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);
  await sbAdmin.from('jobs').delete().in('id', ids);
}

// ═══════════════════════════════════════════════════════════════════════
// CASO 5: Race Condition (Concurrencia)
// ═══════════════════════════════════════════════════════════════════════
async function caso5_RaceCondition(adminId, workerA, workerB) {
  title(5, 'Race Condition (Asignación Concurrente)');

  // 1. Insertamos el trabajo
  step('Admin inserta job "open" (express)…');
  const job = await insertJob(adminId, { booking_type: 'express' });
  jobsToClean.push(job.id);
  await wait(1000);

  // 2. Ejecutar accept_job en paralelo (Promise.all)
  step('Técnico A y Técnico B envían accept_job EXACTAMENTE AL MISMO TIEMPO…');
  const start = Date.now();
  const [resA, resB] = await Promise.all([
    sbWorker.rpc('accept_job', {
      p_job_id: job.id, p_worker_id: workerA,
      p_applicant_lat: 12.13, p_applicant_lng: -86.27
    }),
    sbWorker.rpc('accept_job', {
      p_job_id: job.id, p_worker_id: workerB,
      p_applicant_lat: 12.13, p_applicant_lng: -86.27
    })
  ]);
  const duration = Date.now() - start;
  step(`Transacción concurrente resuelta en ${duration}ms`);

  // Extraer datos de los resultados de RPC
  const dataA = resA.data;
  const dataB = resB.data;

  // Una de las dos tuvo que ganar, la otra fallar
  const oneWon = (dataA?.success === true && dataB?.success === false) ||
                 (dataA?.success === false && dataB?.success === true);
  const loserData = dataA?.success === false ? dataA : dataB;

  assert('[5.1] Sistema resolvió concurrencia limpiamente (Un ganador, un perdedor)', oneWon);
  assert('[5.2] El perdedor recibe error transaccional gracefully',
    loserData?.error?.includes('fue tomado') || loserData?.error?.includes('fue más rápido') || loserData?.error?.includes('está siendo modificada'),
    `Error recibido: ${loserData?.error}`);

  // Verificar estado en BD
  const { data: finalJob } = await sbAdmin.from('jobs').select('status, assigned_worker_id').eq('id', job.id).single();
  assert('[5.3] Job está "taken" por el ganador correcto', finalJob?.status === 'taken' &&
    (finalJob?.assigned_worker_id === workerA || finalJob?.assigned_worker_id === workerB));
}

// ═══════════════════════════════════════════════════════════════════════
// CASO 6: Fuera de Radio (Filtro Geométrico Haversine)
// ═══════════════════════════════════════════════════════════════════════
async function caso6_FueraDeRadio(adminId, workerId) {
  title(6, 'Fuera de Radio (Filtro Haversine > 15km)');

  // 1. Mover técnico A a León (muy lejos de Managua)
  step('Movimientos al Técnico A a León (Lat: 12.4333, Lng: -86.8833)…');
  await sbAdmin.from('worker_profiles').update({
    last_lat: 12.4333, last_lng: -86.8833,
    availability_status: 'available', last_location_at: new Date().toISOString()
  }).eq('worker_id', workerId);

  // 2. Insertar job en Managua
  step('Admin inserta job "open" en Managua…');
  const job = await insertJob(adminId, { lat: 12.1364, lng: -86.2776, category: 'Plomería' });
  jobsToClean.push(job.id);
  await wait(1500);

  // 3. Verificar pool
  // 3. Verificar que workerId NO está en job_assignments para este trabajo
  const { data: assignments } = await sbAdmin.from('job_assignments')
    .select('worker_id')
    .eq('job_id', job.id)
    .eq('worker_id', workerId);
  const isInPool = assignments && assignments.length > 0;

  assert('[6.1] El motor (o el fallback) descarta al técnico por estar fuera del radio',
    !isInPool, `Técnico fue asignado erróneamente al pool`);
}

// ═══════════════════════════════════════════════════════════════════════
// CASO 8: Técnico Offline (Filtro de Estado)
// ═══════════════════════════════════════════════════════════════════════
async function caso8_TecnicoOffline(adminId, workerId) {
  title(8, 'Técnico Offline (Filtro de Estado)');

  // 1. Regresar técnico A a Managua pero ponerlo OFFLINE
  step('Técnico A regresa a Managua pero se pone OFFLINE…');
  await sbAdmin.from('worker_profiles').update({
    last_lat: 12.1364, last_lng: -86.2776,
    availability_status: 'offline', last_location_at: new Date().toISOString()
  }).eq('worker_id', workerId);

  // 2. Insertar job
  step('Admin inserta job "open" en Managua…');
  const job = await insertJob(adminId, { category: 'Plomería' });
  jobsToClean.push(job.id);
  await wait(1500);

  // 3. Verificar pool
  // 3. Verificar que workerId NO está en job_assignments para este trabajo
  const { data: assignments } = await sbAdmin.from('job_assignments')
    .select('worker_id')
    .eq('job_id', job.id)
    .eq('worker_id', workerId);
  const isInPool = assignments && assignments.length > 0;

  assert('[8.1] El motor descarta al técnico por estar offline',
    !isInPool, `Técnico fue asignado erróneamente al pool`);
}


// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log(`${C.magenta}${C.bold}  🧪 CHAMBA — Suite E2E Nivel 2: Marketplace Engine${C.reset}`);
  console.log('═'.repeat(60));

  // 1. Login Admin
  const { data: adminAuth } = await sbAdmin.auth.signInWithPassword({
    email: 'admin@chamba.com', password: 'Admin1234!'
  });
  if (!adminAuth?.user) { console.error('Login admin falló'); process.exit(1); }
  const adminId = adminAuth.user.id;

  step('Creando perfiles temporales frescos para la prueba...');
  // Crear Worker A
  const workerA = crypto.randomUUID();
  const emailA = `worker-a-${Date.now()}@chamba.com`;

  // Crear Worker B
  const workerB = crypto.randomUUID();
  const emailB = `worker-b-${Date.now()}@chamba.com`;

  // Insertar perfiles usando un cliente anónimo puro para aprovechar la política RLS 'anon insert'
  const sbAnon = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const { error: errP } = await sbAnon.from('profiles').insert([
    { id: workerA, email: emailA, role: 'worker', is_approved: true, full_name: 'E2E Worker A' },
    { id: workerB, email: emailB, role: 'worker', is_approved: true, full_name: 'E2E Worker B' }
  ]);
  if (errP) throw new Error(`Insert profiles falló: ${errP.message}`);

  console.log(`\n  ${C.green}✔${C.reset} Admin: ${C.gray}${adminId}${C.reset}`);
  console.log(`  ${C.green}✔${C.reset} Worker A temp: ${C.gray}${workerA}${C.reset}`);
  console.log(`  ${C.green}✔${C.reset} Worker B temp: ${C.gray}${workerB}${C.reset}`);

  // 2. Preparar Worker A y B
  await sbAdmin.from('profiles').update({ role: 'worker', is_approved: true }).in('id', [workerA, workerB]);
  await sbAdmin.from('worker_profiles').upsert([
    {
      worker_id: workerA,
      availability_status: 'available',
      last_lat: 12.1364, last_lng: -86.2776,
      last_location_at: new Date().toISOString(),
      acceptance_rate: 1.0, completion_rate: 1.0,
    },
    {
      worker_id: workerB,
      availability_status: 'available',
      last_lat: 12.1364, last_lng: -86.2776,
      last_location_at: new Date().toISOString(),
      acceptance_rate: 1.0, completion_rate: 1.0,
    }
  ], { onConflict: 'worker_id' });

  // 3. Ejecutar Casos
  try {
    await caso5_RaceCondition(adminId, workerA, workerB);
    await caso6_FueraDeRadio(adminId, workerA);
    await caso8_TecnicoOffline(adminId, workerA);
  } catch (err) {
    console.error(`\n${C.red}💥 Error inesperado:${C.reset}`, err.message);
  }

  // 4. Limpieza de jobs de prueba
  console.log(`\n${C.gray}  🧹 Limpiando jobs de prueba…${C.reset}`);
  await cleanupJobs(jobsToClean);
  console.log(`${C.gray}  ✔ Limpieza completada.${C.reset}`);

  // 5. Reporte
  console.log('\n' + '═'.repeat(60));
  console.log(`${C.bold}  📋 REPORTE FINAL MARKETPLACE${C.reset}`);
  console.log('═'.repeat(60));
  const total = totalPass + totalFail;
  const pct = total > 0 ? Math.round((totalPass / total) * 100) : 0;
  console.log(`\n  Total aserciones : ${total}`);
  console.log(`  ${C.green}Pasadas${C.reset}          : ${totalPass}`);
  console.log(`  ${C.red}Fallidas${C.reset}         : ${totalFail}`);
  console.log(`  Cobertura        : ${pct >= 80 ? C.green : C.red}${pct}%${C.reset}`);
  if (failLog.length > 0) {
    console.log(`\n  ${C.red}${C.bold}Detalle de fallos:${C.reset}`);
    failLog.forEach(f => console.log(`    ${C.red}• ${f}${C.reset}`));
  }
  if (totalFail === 0) {
    console.log(`\n  ${C.green}${C.bold}🎉 CASOS DEL MARKETPLACE VALIDADOS CORRECTAMENTE.${C.reset}`);
  }
  console.log('\n' + '═'.repeat(60) + '\n');
}

main().catch(err => { console.error('\n💥', err.message); process.exit(1); });
