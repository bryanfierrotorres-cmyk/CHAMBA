#!/usr/bin/env node
/**
 * Verifica pins en feed sin crear jobs (útil si clientes están al límite).
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

function hasUsableJobCoordinates(lat, lng) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    (Math.abs(Number(lat)) > 0.0001 || Math.abs(Number(lng)) > 0.0001)
  );
}

function toPins(jobs) {
  return jobs
    .map((job) => {
      const lat = job.lat ?? 0;
      const lng = job.lng ?? 0;
      if (!hasUsableJobCoordinates(lat, lng)) return null;
      return { jobId: job.id, title: job.title, latitude: lat, longitude: lng };
    })
    .filter(Boolean);
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!url || !anon || !dbUrl) {
    console.error('❌ Faltan variables de entorno');
    process.exit(1);
  }

  const pg = await import('pg');
  const db = new pg.default.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  const { rows: workers } = await db.query(`
    SELECT id, full_name, phone FROM profiles
    WHERE role::text = 'worker' AND COALESCE(is_approved, false) = true
    LIMIT 1
  `);
  await db.end();

  if (!workers[0]) {
    console.error('❌ Sin técnico aprobado');
    process.exit(1);
  }

  const worker = workers[0];
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: feed, error } = await supabase.rpc('get_worker_open_jobs_feed', {
    p_worker_id: worker.id,
    p_status: 'open',
    p_categories: null,
    p_limit: 50,
    p_offset: 0,
  });

  if (error || !feed?.success) {
    console.error('❌ Feed:', error?.message ?? feed?.error);
    process.exit(1);
  }

  const jobs = feed.jobs ?? [];
  const pins = toPins(jobs);

  console.log(`Técnico: ${worker.full_name}`);
  console.log(`Jobs open: ${jobs.length}`);
  console.log(`Pins GPS: ${pins.length}\n`);

  for (const pin of pins.slice(0, 10)) {
    console.log(`✅ PIN ${pin.title}`);
    console.log(`   ${pin.latitude}, ${pin.longitude}`);
  }

  if (pins.length >= 2) {
    console.log('\n✅ Funcional — múltiples solicitudes con GPS → múltiples pins (sin aceptar).');
    process.exit(0);
  }
  if (pins.length === 1) {
    console.log('\n⚠️  Solo 1 pin con GPS en BD ahora mismo.');
    process.exit(0);
  }
  console.log('\n❌ Hay jobs open pero ninguno con GPS válido.');
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
