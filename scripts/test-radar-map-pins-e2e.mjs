#!/usr/bin/env node
/**
 * E2E: 2 solicitudes con GPS → feed técnico → pins en mapa (simulado).
 * npm run test:radar-map-pins
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

const LOCATIONS = [
  {
    label: 'Managua Centro',
    lat: 12.1364,
    lng: -86.2514,
    address: 'Managua, Centro — prueba pin 1',
  },
  {
    label: 'Managua Las Colinas',
    lat: 12.1158,
    lng: -86.2682,
    address: 'Managua, Las Colinas — prueba pin 2',
  },
];

function hasUsableJobCoordinates(lat, lng) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001)
  );
}

function toPins(jobs) {
  return jobs
    .map((job) => {
      const lat = job.lat ?? job.location?.lat ?? 0;
      const lng = job.lng ?? job.location?.lng ?? 0;
      if (!hasUsableJobCoordinates(lat, lng)) return null;
      return {
        jobId: job.id,
        title: job.title,
        latitude: lat,
        longitude: lng,
      };
    })
    .filter(Boolean);
}

async function resolveProfiles(supabase) {
  if (dbUrl) {
    const pg = await import('pg');
    const db = new pg.default.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });
    await db.connect();
    const { rows: clients } = await db.query(`
      SELECT id, full_name, phone
      FROM profiles
      WHERE role::text = 'client'
      ORDER BY created_at DESC NULLS LAST
      LIMIT 2
    `);
    const { rows: workers } = await db.query(`
      SELECT id, full_name, phone, is_approved
      FROM profiles
      WHERE role::text = 'worker' AND COALESCE(is_approved, false) = true
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    `);
    await db.end();
    if (clients.length > 0 && workers[0]) {
      return { clients, worker: workers[0] };
    }
  }

  const { data: clientRows } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'client')
    .limit(2);
  const { data: workerRows } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_approved')
    .eq('role', 'worker')
    .eq('is_approved', true)
    .limit(1);

  if (!clientRows?.length || !workerRows?.[0]) {
    throw new Error('No se encontró cliente o técnico aprobado en profiles');
  }
  return { clients: clientRows, worker: workerRows[0] };
}

async function createJob(supabase, clientId, { title, lat, lng, address }) {
  const { data, error } = await supabase.rpc('create_client_job', {
    p_created_by: clientId,
    p_title: title,
    p_description: 'Prueba E2E radar mapa — ubicación GPS compartida',
    p_category: 'limpieza_sofas',
    p_pay_amount: 1500,
    p_address: address,
    p_lat: lat,
    p_lng: lng,
    p_duration_hours: 2,
    p_required_workers: 1,
    p_scheduled_at: null,
    p_media_urls: [],
  });

  if (error) throw new Error(`create_client_job: ${error.message}`);
  if (!data?.success) throw new Error(data?.error ?? 'create_client_job falló');
  return data.job;
}

async function main() {
  if (!url || !anon) {
    console.error('❌ Faltan EXPO_PUBLIC_SUPABASE_URL / ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('=== E2E Radar mapa: 2 solicitudes con GPS ===\n');

  const { clients, worker } = await resolveProfiles(supabase);
  console.log(`Técnico: ${worker.full_name} (${worker.phone ?? worker.id})`);
  for (const c of clients) {
    console.log(`Cliente: ${c.full_name} (${c.phone ?? c.id})`);
  }
  console.log('');

  const created = [];
  const ts = Date.now();

  for (let i = 0; i < LOCATIONS.length; i++) {
    const loc = LOCATIONS[i];
    const client = clients[i] ?? clients[0];
    const { data: activeCount } = await supabase.rpc('count_client_active_jobs', {
      p_client_id: client.id,
    });
    console.log(`Activas ${client.full_name}: ${activeCount ?? '?'}`);

    try {
      const job = await createJob(supabase, client.id, {
        title: `Pin prueba ${i + 1} — ${loc.label} [${ts}]`,
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address,
      });
      created.push({ ...loc, jobId: job.id, title: job.title });
      console.log(`✅ Job ${i + 1} (${client.full_name}): ${job.id}`);
      console.log(`   GPS: ${loc.lat}, ${loc.lng}`);
    } catch (err) {
      console.error(`❌ Job ${i + 1}: ${err.message}`);
      if (String(err.message).includes('2 solicitudes activas')) {
        console.error('   Mama ya tiene 2 activas — cancelá una o usá otro cliente.');
      }
    }
  }

  if (created.length === 0) {
    console.error('\n❌ No se pudieron crear solicitudes de prueba.');
    process.exit(1);
  }

  const { data: feed, error: feedErr } = await supabase.rpc('get_worker_open_jobs_feed', {
    p_worker_id: worker.id,
    p_status: 'open',
    p_categories: null,
    p_limit: 50,
    p_offset: 0,
  });

  if (feedErr) {
    console.error('❌ get_worker_open_jobs_feed:', feedErr.message);
    process.exit(1);
  }
  if (!feed?.success) {
    console.error('❌ Feed:', feed?.error ?? 'falló');
    process.exit(1);
  }

  const jobs = feed.jobs ?? [];
  const pins = toPins(jobs);
  const createdIds = new Set(created.map((c) => c.jobId));
  const pinsForCreated = pins.filter((p) => createdIds.has(p.jobId));

  console.log(`\n--- Feed técnico (${worker.full_name}) ---`);
  console.log(`Jobs open en feed: ${jobs.length}`);
  console.log(`Con GPS usable (pins): ${pins.length}`);

  for (const c of created) {
    const pin = pins.find((p) => p.jobId === c.jobId);
    const inFeed = jobs.some((j) => j.id === c.jobId);
    console.log(`\n· ${c.title}`);
    console.log(`  En feed: ${inFeed ? '✅' : '❌'}`);
    console.log(`  Pin mapa: ${pin ? '✅' : '❌'}`);
    if (pin) {
      console.log(`  Coord pin: ${pin.latitude}, ${pin.longitude}`);
    }
  }

  const allCreatedHavePins =
    created.length > 0 && created.every((c) => pins.some((p) => p.jobId === c.jobId));

  if (allCreatedHavePins && created.length >= 2) {
    console.log('\n✅ E2E OK — 2 solicitudes con GPS visibles como pins en el radar (sin aceptar).');
    process.exit(0);
  }

  if (created.length === 1 && pinsForCreated.length === 1) {
    console.log('\n⚠️  Solo 1 solicitud creada (límite cliente). Esa sí tiene pin.');
    process.exit(0);
  }

  console.log('\n❌ E2E falló — no todas las solicitudes aparecen como pins.');
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
