#!/usr/bin/env node
/**
 * Simulación de estrés: Cliente publica → Radar técnico (<3s) → Admin spam → desaparece.
 * npm run test:realtime-stress
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FEED_DEADLINE_MS = 3000;
const MODERATION_DEADLINE_MS = 3000;
const POLL_MS = 150;

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

const supabase = createClient(url, anon, { auth: { persistSession: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parseRpcFeed = (data) => {
  const body = typeof data === 'string' ? JSON.parse(data) : data;
  if (!body?.success) return { ok: false, error: body?.error, jobs: [] };
  return { ok: true, jobs: body.jobs ?? [] };
};

async function pgQuery(sql, params = []) {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const res = await db.query(sql, params);
  await db.end();
  return res.rows;
}

async function fetchWorkerFeed(workerId) {
  const { data, error } = await supabase.rpc('get_worker_open_jobs_feed', {
    p_worker_id: workerId,
    p_status: 'open',
    p_categories: null,
    p_limit: 50,
    p_offset: 0,
  });
  if (error) return { ok: false, error: error.message, jobs: [] };
  return parseRpcFeed(data);
}

async function waitForJobInFeed(workerId, jobId, deadlineMs, label) {
  const start = Date.now();
  let lastCount = 0;

  while (Date.now() - start < deadlineMs) {
    const feed = await fetchWorkerFeed(workerId);
    if (!feed.ok) throw new Error(`${label}: feed RPC — ${feed.error}`);
    lastCount = feed.jobs.length;
    if (feed.jobs.some((j) => j.id === jobId)) {
      return { elapsedMs: Date.now() - start, feedCount: lastCount };
    }
    await sleep(POLL_MS);
  }

  throw new Error(
    `${label}: job ${jobId} no apareció en feed en ${deadlineMs}ms (último count=${lastCount})`,
  );
}

async function waitForJobGoneFromFeed(workerId, jobId, deadlineMs, label) {
  const start = Date.now();

  while (Date.now() - start < deadlineMs) {
    const feed = await fetchWorkerFeed(workerId);
    if (!feed.ok) throw new Error(`${label}: feed RPC — ${feed.error}`);
    if (!feed.jobs.some((j) => j.id === jobId)) {
      return { elapsedMs: Date.now() - start };
    }
    await sleep(POLL_MS);
  }

  throw new Error(`${label}: job ${jobId} sigue en feed tras ${deadlineMs}ms`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  SIMULACIÓN ESTRÉS — Cliente → Radar → Admin spam');
  console.log('═══════════════════════════════════════════════════\n');

  const rpcCheck = await pgQuery(
    `SELECT proname FROM pg_proc WHERE proname = 'admin_moderate_remove_job'`,
  );
  if (!rpcCheck.length) {
    console.error('❌ Falta migración 037 — ejecutá: npm run db:apply-admin-moderation');
    process.exit(1);
  }
  console.log('✓ RPC admin_moderate_remove_job presente\n');

  const workers = await pgQuery(
    `SELECT id, full_name, is_approved, category_1, category_1_approved
     FROM profiles
     WHERE role::text = 'worker' AND COALESCE(is_approved, false) = true
     ORDER BY created_at DESC LIMIT 5`,
  );
  const worker = workers[0];
  if (!worker) {
    console.error('❌ No hay técnico aprobado en profiles');
    process.exit(1);
  }

  const clients = await pgQuery(
    `SELECT id, full_name FROM profiles WHERE role::text = 'client' LIMIT 1`,
  );
  const client = clients[0];
  if (!client) {
    console.error('❌ No hay cliente en profiles');
    process.exit(1);
  }

  const admins = await pgQuery(
    `SELECT id, full_name FROM profiles
     WHERE role::text = 'admin' AND COALESCE(is_approved, false) = true
     LIMIT 1`,
  );
  const admin = admins[0];
  if (!admin) {
    console.error('❌ No hay admin aprobado');
    process.exit(1);
  }

  const jobCategory =
    worker.category_1_approved && worker.category_1
      ? worker.category_1
      : 'limpieza_sofas';
  const runId = Date.now().toString(36);
  const title = `Stress test ${runId}`;

  console.log(`Cliente:  ${client.full_name} (${client.id})`);
  console.log(`Técnico:  ${worker.full_name} (${worker.id})`);
  console.log(`Admin:    ${admin.full_name} (${admin.id})`);
  console.log(`Categoría: ${jobCategory}\n`);

  const rtEvents = [];
  let rtSubscribedAt = 0;

  const rtChannel = supabase
    .channel(`stress-job-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'jobs' },
      (p) => {
        if (p.new?.id) rtEvents.push({ type: 'INSERT', id: p.new.id, at: Date.now() });
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'jobs' },
      (p) => {
        if (p.new?.id) {
          rtEvents.push({ type: 'UPDATE', id: p.new.id, status: p.new?.status, at: Date.now() });
        }
      },
    );

  await new Promise((resolve) => {
    rtChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        rtSubscribedAt = Date.now();
        resolve();
      }
    });
  });

  const t0 = Date.now();
  const { data: createData, error: createErr } = await supabase.rpc('create_client_job', {
    p_created_by: client.id,
    p_title: title,
    p_description: 'Simulación estrés CHAMBA — borrar como spam.',
    p_category: jobCategory,
    p_pay_amount: 1500,
    p_address: 'Managua, prueba estrés',
    p_lat: 12.1328,
    p_lng: -86.2504,
    p_duration_hours: 2,
    p_required_workers: 1,
    p_scheduled_at: null,
    p_media_urls: [],
  });

  if (createErr) {
    console.error('❌ create_client_job:', createErr.message);
    process.exit(1);
  }

  const createBody = typeof createData === 'string' ? JSON.parse(createData) : createData;
  if (!createBody?.success || !createBody?.job?.id) {
    console.error('❌ create_client_job rechazado:', createBody?.error ?? createBody);
    process.exit(1);
  }

  const jobId = createBody.job.id;
  const createMs = Date.now() - t0;
  console.log(`✓ Job publicado en ${createMs}ms — id: ${jobId}`);
  console.log(`  título: ${title}\n`);

  const feedAppear = await waitForJobInFeed(
    worker.id,
    jobId,
    FEED_DEADLINE_MS,
    'Radar técnico',
  );
  const appearOk = feedAppear.elapsedMs < FEED_DEADLINE_MS;
  console.log(
    `${appearOk ? '✓' : '⚠'} Feed técnico: visible en ${feedAppear.elapsedMs}ms ` +
      `(límite ${FEED_DEADLINE_MS}ms, ${feedAppear.feedCount} jobs open)`,
  );

  const { data: modData, error: modErr } = await supabase.rpc('admin_moderate_remove_job', {
    p_job_id: jobId,
    p_admin_id: admin.id,
    p_reason: 'spam',
  });

  if (modErr) {
    console.error('❌ admin_moderate_remove_job:', modErr.message);
    process.exit(1);
  }

  const modBody = typeof modData === 'string' ? JSON.parse(modData) : modData;
  if (!modBody?.success) {
    console.error('❌ Moderación rechazada:', modBody?.error ?? modBody);
    process.exit(1);
  }

  console.log(`✓ Admin marcó como spam — status: ${modBody.job?.status}\n`);

  await sleep(400);
  const feedGone = await waitForJobGoneFromFeed(
    worker.id,
    jobId,
    MODERATION_DEADLINE_MS,
    'Radar tras moderación',
  );
  const goneOk = feedGone.elapsedMs < MODERATION_DEADLINE_MS;
  console.log(
    `${goneOk ? '✓' : '⚠'} Feed técnico: job ausente en ${feedGone.elapsedMs}ms ` +
      `(límite ${MODERATION_DEADLINE_MS}ms)`,
  );

  await sleep(800);
  const updateEvent = rtEvents.find((e) => e.type === 'UPDATE' && e.id === jobId);
  const insertEvent = rtEvents.find((e) => e.type === 'INSERT' && e.id === jobId);

  console.log('\n── Realtime (canal supabase) ──');
  if (insertEvent) {
    console.log(`✓ INSERT recibido (${insertEvent.at - t0}ms desde publicación)`);
  } else {
    console.log('⚠ INSERT realtime no capturado (RLS/sesión anónima — feed RPC sí validó)');
  }
  if (updateEvent) {
    console.log(
      `✓ UPDATE recibido — status: ${updateEvent.status} (${updateEvent.at - t0}ms desde publicación)`,
    );
  } else {
    console.log('⚠ UPDATE realtime no capturado (app con auth alineada debería recibirlo)');
  }

  await supabase.removeChannel(rtChannel);

  const jobRow = await pgQuery(
    `SELECT status::text, moderation_reason FROM jobs WHERE id = $1`,
    [jobId],
  );
  const row = jobRow[0];
  console.log('\n── Auditoría BD ──');
  console.log(`  status: ${row?.status} | moderation_reason: ${row?.moderation_reason ?? '—'}`);

  const allPass = appearOk && goneOk && row?.status === 'cancelled';

  console.log('\n═══════════════════════════════════════════════════');
  if (allPass) {
    console.log('  [ESTRÉS OK] Publicación → radar → moderación spam');
  } else {
    console.log('  [ESTRÉS PARCIAL] Revisar tiempos o realtime en dispositivo');
  }
  console.log('═══════════════════════════════════════════════════\n');

  console.log('Checklist manual en 2 dispositivos:');
  console.log('  [ ] Cliente publica → radar/mapas del técnico < 3s');
  console.log('  [ ] Admin retira spam → tarjeta desaparece sin congelar UI');
  console.log(`  [ ] Buscar título de prueba: "${title}" (ya moderado en BD)\n`);

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});
