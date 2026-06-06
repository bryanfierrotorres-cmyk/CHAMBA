#!/usr/bin/env node
/**
 * E2E publicación cliente — replica CreateJobFormScreen + createJob
 * npm run test:client-publish
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!url || !anon || !dbUrl) {
  console.error('❌ Faltan EXPO_PUBLIC_SUPABASE_URL, ANON_KEY o SUPABASE_DB_URL');
  process.exit(1);
}

const supabase = createClient(url, anon);
const pg = await import('pg');

async function getClient() {
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const { rows } = await db.query(`
    SELECT id, full_name, phone, email, role::text AS role, is_approved
    FROM profiles WHERE role::text = 'client'
    ORDER BY created_at DESC NULLS LAST LIMIT 1
  `);
  await db.end();
  return rows[0] ?? null;
}

async function countActive(clientId) {
  const { data, error } = await supabase.rpc('count_client_active_jobs', { p_client_id: clientId });
  return { count: data, error: error?.message };
}

async function resolveClientIdForJobs(profile) {
  const phone = (profile.phone ?? '').replace(/\D/g, '');
  const { data: byPhone } = await supabase.rpc('get_profile_by_phone', { p_phone: phone });
  let synced = profile;
  if (byPhone?.id) synced = { ...profile, id: byPhone.id };

  const { error: upsertErr } = await supabase.from('profiles').upsert(
    {
      id: synced.id,
      full_name: synced.full_name.trim(),
      phone: phone || null,
      email: synced.email ?? `${phone}@phone.chamba.local`,
      role: 'client',
      is_approved: !!synced.is_approved,
    },
    { onConflict: 'id' },
  );
  return { creatorId: synced.id, upsertErr: upsertErr?.message ?? null };
}

async function createJobLikeApp(params) {
  const rpcBase = {
    p_created_by: params.createdBy,
    p_title: params.title,
    p_description: params.description,
    p_pay_amount: params.payAmount,
    p_address: params.address,
    p_lat: params.lat,
    p_lng: params.lng,
    p_duration_hours: params.durationHours,
    p_required_workers: params.requiredWorkers,
    p_scheduled_at: null,
    p_media_urls: [],
  };

  const categories = [params.category, 'sofas', 'limpieza_sofas'].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  let lastRpc = null;
  for (const cat of categories) {
    const { data, error } = await supabase.rpc('create_client_job', {
      ...rpcBase,
      p_category: cat,
    });
    lastRpc = { cat, data, error };
    if (!error && data?.success && data?.job) {
      return { ok: true, job: data.job, via: 'rpc', category: cat };
    }
  }

  const platformFee = parseFloat((params.payAmount * 0.05).toFixed(2));
  const workerPayout = parseFloat((params.payAmount * 0.95).toFixed(2));
  let lastIns = null;
  for (const cat of categories) {
    const { data, error } = await supabase.from('jobs').insert({
      title: params.title,
      description: params.description,
      category: cat,
      pay_amount: params.payAmount,
      platform_fee: platformFee,
      worker_payout: workerPayout,
      address: params.address,
      lat: params.lat,
      lng: params.lng,
      duration_hours: params.durationHours,
      required_workers: params.requiredWorkers,
      media_urls: [],
      created_by: params.createdBy,
      status: 'open',
    }).select().single();
    lastIns = { cat, data, error };
    if (!error && data) {
      return { ok: true, job: data, via: 'insert', category: cat };
    }
  }

  return {
    ok: false,
    lastRpc,
    lastIns,
  };
}

async function cleanupJob(jobId) {
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.query('DELETE FROM jobs WHERE id = $1', [jobId]);
  await db.end();
}

async function checkCategoryColumn() {
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const { rows } = await db.query(`
    SELECT udt_name FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'category'
  `);
  await db.end();
  return rows[0]?.udt_name;
}

console.log('\n══════════════════════════════════════');
console.log('  PRUEBA E2E — Publicación cliente CHAMBA');
console.log('══════════════════════════════════════\n');

const categoryType = await checkCategoryColumn();
console.log('1. jobs.category tipo:', categoryType);
if (categoryType !== 'text') {
  console.log('   ⚠️  Ejecutá: npm run db:fix-job-category');
}

const client = await getClient();
if (!client) {
  console.error('❌ No hay perfil client en BD. Registrate como cliente primero.');
  process.exit(1);
}
console.log('2. Cliente:', client.full_name, '|', client.phone, '|', client.id.slice(0, 8) + '…');

const active = await countActive(client.id);
console.log('3. Solicitudes activas:', active.count, active.error ? `(err: ${active.error})` : '');

const { creatorId, upsertErr } = await resolveClientIdForJobs(client);
console.log('4. resolveClientIdForJobs →', creatorId.slice(0, 8) + '…', upsertErr ? `(upsert warn: ${upsertErr})` : 'OK');

const payload = {
  title: 'Solicitud E2E prueba automática',
  description: 'Descripción de prueba con más de diez caracteres para validar publicación.',
  category: 'limpieza_sofas',
  payAmount: 1400,
  address: 'Colonia Los Robles, Managua',
  lat: 0,
  lng: 0,
  durationHours: 2,
  requiredWorkers: 1,
  createdBy: creatorId,
};

console.log('5. Enviando createJob (limpieza_sofas, C$1400)…\n');
const result = await createJobLikeApp(payload);

if (result.ok) {
  console.log('✅ PUBLICACIÓN EXITOSA');
  console.log('   vía:', result.via);
  console.log('   categoría:', result.category);
  console.log('   job id:', result.job.id);
  console.log('   status:', result.job.status);
  await cleanupJob(result.job.id);
  console.log('\n   (job de prueba eliminado para no ensuciar la BD)\n');
  process.exit(0);
}

console.log('❌ PUBLICACIÓN FALLÓ\n');
if (result.lastRpc) {
  console.log('Último RPC:');
  console.log('  categoría:', result.lastRpc.cat);
  if (result.lastRpc.error) {
    console.log('  error:', JSON.stringify(result.lastRpc.error, null, 2));
  } else {
    console.log('  data:', JSON.stringify(result.lastRpc.data, null, 2));
  }
}
if (result.lastIns) {
  console.log('\nÚltimo INSERT directo:');
  console.log('  categoría:', result.lastIns.cat);
  if (result.lastIns.error) {
    console.log('  error:', JSON.stringify(result.lastIns.error, null, 2));
  }
}
process.exit(1);
