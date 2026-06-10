#!/usr/bin/env node
/** Radar técnico: open jobs vs feed RPC. npm run diagnose:worker-radar */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAPA_ID = '43ce7eec-c77a-497a-a1d1-99e0946b83f8';

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

async function main() {
  const pg = await import('pg');
  const db = new pg.default.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const { rows: workers } = await db.query(`
    SELECT id, full_name, phone, is_approved, worker_status,
           category_1::text, category_1_approved,
           category_2::text, category_2_approved
    FROM profiles
    WHERE role::text = 'worker' AND is_approved = true
    ORDER BY updated_at DESC
    LIMIT 5
  `);

  const { rows: openAll } = await db.query(`
    SELECT id, title, category::text AS category, status::text AS status,
           created_at, created_by,
           EXTRACT(EPOCH FROM (NOW() - created_at))/60 AS age_min
    FROM jobs
    WHERE status::text = 'open'
    ORDER BY created_at DESC
    LIMIT 30
  `);

  const { rows: openRecent } = await db.query(`
    SELECT COUNT(*)::int AS total FROM jobs
    WHERE status::text = 'open' AND created_at >= NOW() - INTERVAL '60 minutes'
  `);

  console.log('\n=== Workers aprobados (muestra) ===\n');
  for (const w of workers) console.log(w);

  console.log(`\n=== Jobs OPEN en BD: ${openAll.length} (últimos 30) ===`);
  console.log(`Open últimos 60 min (regla radar): ${openRecent[0]?.total ?? 0}\n`);

  for (const j of openAll) {
    console.log({
      title: j.title,
      category: j.category,
      age_min: Math.round(Number(j.age_min)),
      in_radar_window: Number(j.age_min) <= 60,
    });
  }

  const sb = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  for (const worker of workers.filter((w) => w.phone === '84888888' || w.id === PAPA_ID).slice(0, 1).concat(
    workers.filter((w) => w.phone !== '84888888' && w.id !== PAPA_ID).slice(0, 2),
  )) {
    console.log(`\n--- Feed RPC: ${worker.full_name} (${worker.phone}) ---`);

    const { data: allCats, error: err1 } = await sb.rpc('get_worker_open_jobs_feed', {
      p_worker_id: worker.id,
      p_status: 'open',
      p_categories: null,
      p_limit: 30,
      p_offset: 0,
    });
    console.log('Sin filtro categoría:', err1?.message ?? {
      success: allCats?.success,
      error: allCats?.error,
      count: allCats?.count,
      jobs: (allCats?.jobs ?? []).map((j) => `[${j.category}] ${j.title}`),
    });

    const cats = [worker.category_1, worker.category_2].filter(Boolean);
    const { data: filtered, error: err2 } = await sb.rpc('get_worker_open_jobs_feed', {
      p_worker_id: worker.id,
      p_status: 'open',
      p_categories: cats,
      p_limit: 30,
      p_offset: 0,
    });
    console.log('Con categorías perfil:', cats, err2?.message ?? {
      count: filtered?.count,
      jobs: (filtered?.jobs ?? []).map((j) => `[${j.category}] ${j.title}`),
    });
  }

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
