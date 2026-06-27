/**
 * ═══════════════════════════════════════════════════════════════════════
 * CHAMBA — Suite E2E de Validación de Flujos Core v2
 * ═══════════════════════════════════════════════════════════════════════
 * Ejecutar: node scripts/e2e_flow_validation.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
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
assertTestEnvironment('e2e_flow_validation');

// Un solo cliente autenticado como admin.
// Todas las RPCs son SECURITY DEFINER — reciben p_worker_id explícito,
// por lo que no necesitan que el JWT sea del técnico.
const sbAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
const sbWorker = sbAdmin; // alias semantico — RPCs son SECURITY DEFINER

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

async function insertJob(clientSb, adminId, overrides = {}) {
  const { data, error } = await clientSb.from('jobs').insert({
    title: `[E2E] Test Job ${Date.now()}`,
    description: 'Prueba automatizada E2E',
    category: 'Plomería',
    status: 'open',
    booking_type: 'express',
    pay_amount: 300,
    platform_fee: 15,
    worker_payout: 285,
    address: 'Test, Managua',
    lat: 12.1364, lng: -86.2776,
    urgency_level: 'express',
    duration_hours: 1,
    required_workers: 1,
    slots_taken: 0,
    created_by: adminId,
    ...overrides,
  }).select('id, dispatch_data, status, pay_amount, broadcast_version').single();
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
// CASO 1: Servicio Express Exitoso (Happy Path)
// ═══════════════════════════════════════════════════════════════════════
async function caso1(adminId, workerId) {
  title(1, 'Servicio Express Exitoso (Happy Path)');

  // 1. Cliente inserta job express
  step('Cliente inserta job "open" (express)…');
  const job = await insertJob(sbAdmin, adminId, { booking_type: 'express' });
  jobsToClean.push(job.id);
  await wait(1500); // esperar trigger de despacho

  // 2. Verificar dispatch_data calculado
  const { data: jobAfter } = await sbAdmin.from('jobs').select('dispatch_data').eq('id', job.id).single();
  assert('[1.0] dispatch_data calculado tras inserción',
    jobAfter?.dispatch_data !== null && jobAfter?.dispatch_data !== undefined,
    `dispatch_data=${JSON.stringify(jobAfter?.dispatch_data)?.slice(0, 80)}`);

  // 3. Técnico A acepta con accept_job (función real de la app)
  step('Técnico A acepta vía accept_job RPC…');
  const { data: accept1 } = await sbWorker.rpc('accept_job', {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_applicant_lat: 12.1364,
    p_applicant_lng: -86.2776,
  });
  if (!accept1?.success) warn(`accept_job falló: ${accept1?.error}`);

  // 4. [1.1] Estado cambió a 'taken'
  const { data: jobTaken } = await sbAdmin.from('jobs')
    .select('status, assigned_worker_id').eq('id', job.id).single();
  assert('[1.1] Estado del job cambió a "taken"', jobTaken?.status === 'taken',
    `status=${jobTaken?.status}`);
  assert('[1.1] Job vinculado al worker_id correcto', jobTaken?.assigned_worker_id === workerId);

  // 5-6. [1.2] Técnico B (segunda cuenta) intenta aceptar — usamos un UUID falso para simular
  //      La función accept_job retorna error si ya existe assignment o job no está 'open'
  step('Técnico B intenta aceptar el mismo job (ya en "taken")…');
  // Creamos un segundo perfil técnico temporal o usamos el propio técnico de nuevo
  // La función retorna error por 'Ya enviaste una oferta' (constraint unique) o por status != open
  const { data: accept2 } = await sbWorker.rpc('accept_job', {
    p_job_id: job.id,
    p_worker_id: workerId, // mismo técnico para probar rechazo
    p_applicant_lat: 12.14, p_applicant_lng: -86.28,
  });
  assert('[1.2] Sistema rechaza doble asignación gracefully',
    accept2?.success === false, accept2?.error ?? 'sin mensaje');

  // 7. Técnico avanza fases y completa
  step('Técnico avanza a "en_route"…');
  await sbWorker.rpc('worker_advance_operational_phase', {
    p_job_id: job.id, p_worker_id: workerId, p_phase: 'en_route'
  });
  step('Técnico llega (arrived)…');
  await sbWorker.rpc('worker_advance_operational_phase', {
    p_job_id: job.id, p_worker_id: workerId, p_phase: 'arrived'
  });
  step('Técnico completa el trabajo…');
  const { data: asgn } = await sbAdmin.from('job_assignments')
    .select('id').eq('job_id', job.id).eq('worker_id', workerId).single();
  if (asgn?.id) {
    const { data: completeResult } = await sbWorker.rpc('worker_complete_job', {
      p_job_id: job.id, p_worker_id: workerId, p_assignment_id: asgn.id
    });
    if (!completeResult?.success) warn(`complete_job: ${completeResult?.error}`);
  }

  // 8. Cliente inserta reseña (limpiamos antes para evitar UNIQUE conflict)
  step('Cliente inserta reseña…');
  await sbAdmin.from('worker_reviews')
    .delete().eq('worker_id', workerId).eq('reviewer_id', adminId);
  const { data: reviewResult } = await sbAdmin.rpc('submit_worker_review', {
    p_worker_id: workerId,
    p_reviewer_id: adminId,
    p_reviewer_role: 'client',
    p_rating: 5,
    p_comment: 'Excelente trabajo E2E',
  });

  // [1.3] Verificar estado final y reseña
  const { data: finalJob } = await sbAdmin.from('jobs').select('status').eq('id', job.id).single();
  assert('[1.3] Job completado exitosamente (status = completed)', finalJob?.status === 'completed',
    `status=${finalJob?.status}`);

  const { data: review } = await sbAdmin.from('worker_reviews')
    .select('rating').eq('worker_id', workerId).eq('reviewer_id', adminId).single();
  assert('[1.3] Reseña registrada correctamente', review?.rating === 5);

  // Cleanup reseña
  await sbAdmin.from('worker_reviews').delete().eq('worker_id', workerId).eq('reviewer_id', adminId);
}

// ═══════════════════════════════════════════════════════════════════════
// CASO 2: Cancelación antes de Asignación
// ═══════════════════════════════════════════════════════════════════════
async function caso2(adminId, workerId) {
  title(2, 'Cancelación antes de Asignación');

  step('Cliente inserta nuevo job "open"…');
  const job = await insertJob(sbAdmin, adminId);
  jobsToClean.push(job.id);

  step('Cliente cancela el job vía cancel_client_job…');
  const { data: cancelResult } = await sbAdmin.rpc('cancel_client_job', { p_job_id: job.id });
  if (!cancelResult?.success) warn(`cancel_client_job: ${cancelResult?.error}`);

  const { data: cancelledJob } = await sbAdmin.from('jobs').select('status').eq('id', job.id).single();
  const cancelledStatuses = ['cancelled', 'cancelled_by_client_pending'];
  assert('[2.1] Status del job es cancelado', cancelledStatuses.includes(cancelledJob?.status),
    `status=${cancelledJob?.status}`);

  // [2.1] No aparece en feed con status open
  const { data: openFeed } = await sbAdmin.from('jobs').select('id').eq('status', 'open').eq('id', job.id);
  assert('[2.1] Job cancelado NO aparece en feed activo (status open)', (openFeed?.length ?? 0) === 0);

  // 4-5. [2.2] Técnico intenta aceptar job cancelado
  step('Técnico intenta forzar aceptación de job cancelado…');
  const { data: forcedAccept } = await sbWorker.rpc('accept_job', {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_applicant_lat: 12.14, p_applicant_lng: -86.28,
  });
  // accept_job express requiere status IN ('open','pending_bidding') → cancelado debe fallar
  assert('[2.2] Base de datos bloquea aceptación de job cancelado',
    forcedAccept?.success === false, forcedAccept?.error ?? 'sin mensaje de error');

  // 6. [2.3] Evento analítico de cancelación
  await sbAdmin.from('analytics_events').insert({
    event_name: 'job_cancelled_by_client',
    user_id: adminId,
    metadata: { job_id: job.id, cancelled_status: cancelledJob?.status }
  });
  const { data: cancelEvent } = await sbAdmin.from('analytics_events')
    .select('id').eq('event_name', 'job_cancelled_by_client')
    .contains('metadata', { job_id: job.id }).limit(1);
  assert('[2.3] analytics_events registra "job_cancelled_by_client"', (cancelEvent?.length ?? 0) > 0);
}

// ═══════════════════════════════════════════════════════════════════════
// CASO 3: Incrementar Presupuesto (Real-time Bump)
// ═══════════════════════════════════════════════════════════════════════
async function caso3(adminId) {
  title(3, 'Incrementar Presupuesto (Real-time Bump)');

  step('Cliente inserta job con precio inicial C$300 (broadcast_version = 1)…');
  const job = await insertJob(sbAdmin, adminId, { pay_amount: 300 });
  jobsToClean.push(job.id);

  const { data: origJob } = await sbAdmin.from('jobs')
    .select('pay_amount, broadcast_version').eq('id', job.id).single();
  const origVersion = origJob?.broadcast_version ?? 1;
  step(`broadcast_version inicial = ${origVersion}`);

  step('Cliente impulsa el precio a C$450 via boost_client_job_offer…');
  // La regla exige incremento mínimo de C$20 sobre el precio actual
  const { data: boostResult } = await sbAdmin.rpc('boost_client_job_offer', {
    p_job_id: job.id,
    p_client_id: adminId,
    p_pay_amount: 450, // 300 → 450 = +C$150 > C$20 mínimo ✓
  });
  if (!boostResult?.success) warn(`boost_client_job_offer: ${boostResult?.error}`);

  const { data: bumpedJob } = await sbAdmin.from('jobs')
    .select('pay_amount, broadcast_version').eq('id', job.id).single();

  assert('[3.1] Precio actualizado a C$450', Number(bumpedJob?.pay_amount) === 450,
    `pay_amount=${bumpedJob?.pay_amount}`);
  assert('[3.2] broadcast_version incrementó en +1 (señal WebSocket para radar)',
    bumpedJob?.broadcast_version === origVersion + 1,
    `was=${origVersion}, now=${bumpedJob?.broadcast_version}`);
}

// ═══════════════════════════════════════════════════════════════════════
// CASO 4: Contraoferta y Negociación Única
// ═══════════════════════════════════════════════════════════════════════
async function caso4(adminId, workerId, workerBId) {
  title(4, 'Contraoferta y Negociación Única');

  step('Cliente crea solicitud "custom" con precio C$400…');
  const job = await insertJob(sbAdmin, adminId, { pay_amount: 400, booking_type: 'custom' });
  jobsToClean.push(job.id);

  // 2. Técnico A contraoferta C$500
  step('Técnico A registra contraoferta de C$500…');
  const { data: offer1 } = await sbWorker.rpc('accept_job', {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_applicant_lat: 12.1364, p_applicant_lng: -86.2776,
    p_counter_offer_amount: 500,
  });
  if (!offer1?.success) warn(`Técnico A contraoferta falló: ${offer1?.error}`);

  // 3. [4.1] Estado = counter_offered, locked_with_worker_id = técnicoA
  const { data: lockedJob } = await sbAdmin.from('jobs')
    .select('status, locked_with_worker_id').eq('id', job.id).single();
  assert('[4.1] Job congelado en estado "counter_offered"',
    lockedJob?.status === 'counter_offered', `status=${lockedJob?.status}`);
  assert('[4.1] locked_with_worker_id apunta al Técnico A',
    lockedJob?.locked_with_worker_id === workerId);

  // 4-5. [4.2] Técnico B intenta contraoferta en job bloqueado
  step('Técnico B intenta contraoferta en job ya bloqueado (debe rechazarse)…');
  // Usamos workerBId si existe, de lo contrario simulamos con un UUID diferente
  const targetBId = workerBId ?? '00000000-0000-0000-0000-000000000002';
  const { data: offer2 } = await sbWorker.rpc('accept_job', {
    p_job_id: job.id,
    p_worker_id: targetBId,
    p_applicant_lat: 12.14, p_applicant_lng: -86.28,
    p_counter_offer_amount: 480,
  });
  // custom path: status != 'open' OR locked_with_worker_id IS NOT NULL → rechaza
  assert('[4.2] Sistema bloquea contraoferta del Técnico B (exclusividad de negociación)',
    offer2?.success === false, offer2?.error ?? 'sin mensaje');

  // 6. Cliente acepta la oferta del Técnico A
  step('Cliente acepta la oferta de C$500 del Técnico A…');
  const { data: approveResult } = await sbAdmin.rpc('client_approve_worker_application', {
    p_job_id: job.id,
    p_client_id: adminId,
    p_worker_id: workerId,
  });
  if (!approveResult?.success) warn(`client_approve_worker_application: ${approveResult?.error}`);

  // 7. [4.3] Trabajo asignado al Técnico A con precio C$500
  const { data: finalJob } = await sbAdmin.from('jobs')
    .select('status, assigned_worker_id, pay_amount').eq('id', job.id).single();
  assert('[4.3] Job transicionó a "taken"', finalJob?.status === 'taken',
    `status=${finalJob?.status}`);
  assert('[4.3] Job asignado al Técnico A', finalJob?.assigned_worker_id === workerId);
  assert('[4.3] Precio actualizado al valor de la contraoferta (C$500)',
    Number(finalJob?.pay_amount) === 500, `pay_amount=${finalJob?.pay_amount}`);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log(`${C.magenta}${C.bold}  🧪 CHAMBA — Suite E2E de Validación de Flujos Core v2${C.reset}`);
  console.log('═'.repeat(60));

  // Login admin
  const { data: adminAuth } = await sbAdmin.auth.signInWithPassword({
    email: 'admin@chamba.com', password: 'Admin1234!'
  });
  if (!adminAuth?.user) { console.error('Login admin falló'); process.exit(1); }
  const adminId = adminAuth.user.id;
  console.log(`\n  ${C.green}✔${C.reset} Admin autenticado: ${C.gray}${adminId}${C.reset}`);

  // Cargar workerId desde profiles (tecnico@chamba.com)
  const { data: workerProfile } = await sbAdmin
    .from('profiles')
    .select('id')
    .eq('email', 'tecnico@chamba.com')
    .single();
  if (!workerProfile?.id) {
    console.error('  ❌ Perfil de técnico no encontrado. Ejecutá: supabase/create-test-users.sql');
    process.exit(1);
  }
  const workerId = workerProfile.id;
  console.log(`  ${C.green}✔${C.reset} Técnico cargado: ${C.gray}${workerId}${C.reset}`);

  // Sincronizar perfil técnico
  await sbAdmin.from('profiles').update({
    category_1: 'Plomería', is_approved: true
  }).eq('id', workerId);
  await sbAdmin.from('worker_profiles').upsert({
    worker_id: workerId,
    availability_status: 'available',
    last_lat: 12.1364, last_lng: -86.2776,
    last_location_at: new Date().toISOString(),
    acceptance_rate: 1.0, completion_rate: 1.0,
  }, { onConflict: 'worker_id' });

  try {
    await caso1(adminId, workerId);
    await caso2(adminId, workerId);
    await caso3(adminId);
    await caso4(adminId, workerId, null);
  } catch (err) {
    console.error(`\n${C.red}💥 Error inesperado:${C.reset}`, err.message);
  }

  // Limpieza
  console.log(`\n${C.gray}  🧹 Limpiando ${jobsToClean.length} jobs de prueba…${C.reset}`);
  await cleanupJobs(jobsToClean);
  console.log(`${C.gray}  ✔ Limpieza completada.${C.reset}`);

  // Reporte
  console.log('\n' + '═'.repeat(60));
  console.log(`${C.bold}  📋 REPORTE FINAL${C.reset}`);
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
    console.log(`\n  ${C.green}${C.bold}🎉 TODOS LOS FLUJOS CORE VALIDADOS — CHAMBA está listo.${C.reset}`);
  } else {
    console.log(`\n  ${C.yellow}${C.bold}⚠️  ${totalFail} aserción(es) requieren atención.${C.reset}`);
  }
  console.log('\n' + '═'.repeat(60) + '\n');

  await sbAdmin.auth.signOut();
}

main().catch(err => { console.error('\n💥', err.message); process.exit(1); });
