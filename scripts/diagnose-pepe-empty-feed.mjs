#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PEPE_ID = '11111111-1111-1111-1111-111111111102';

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

  const { rows: [pepe] } = await db.query(`
    SELECT id, full_name, phone, is_approved, category_1, category_1_approved, category_2, category_2_approved
    FROM profiles WHERE phone = '84888888' OR id = $1 LIMIT 1
  `, [PEPE_ID]);

  const { rows: openJobs } = await db.query(`
    SELECT id, title, category::text, status::text FROM jobs
    WHERE status::text = 'open' ORDER BY created_at DESC LIMIT 20
  `);

  console.log('Pepe BD:', pepe);
  console.log('Jobs open en BD:', openJobs.length);
  openJobs.forEach((j) => console.log(`  [${j.category}] ${j.title}`));

  await db.end();

  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  const { data: direct } = await client
    .from('jobs')
    .select('id, title, category, status')
    .eq('status', 'open')
    .limit(10);
  console.log('\nAnon SELECT jobs (sin sesión):', direct?.length ?? 0, direct?.error?.message);

  const cats = ['sofas', 'limpieza_sofas', 'conserjeria_ocasional', 'limpieza_banos', 'alfombra', 'limpieza_alfombra'];
  const { data: wRpc, error: wErr } = await client.rpc('get_worker_open_jobs_feed', {
    p_worker_id: pepe?.id ?? PEPE_ID,
    p_status: 'open',
    p_categories: cats,
    p_limit: 30,
    p_offset: 0,
  });
  console.log('\nRPC worker feed:', wErr?.message ?? `OK ${wRpc?.jobs?.length ?? 0} jobs`);
  if (wRpc?.error) console.log('  RPC error body:', wRpc.error);
  (wRpc?.jobs ?? []).slice(0, 8).forEach((j) => console.log(`  · [${j.category}] ${j.title}`));

  const { data: oRpc } = await client.rpc('get_open_jobs_feed', {
    p_status: 'open',
    p_categories: cats,
    p_limit: 10,
    p_offset: 0,
  });
  console.log('\nRPC get_open_jobs_feed (sin auth):', oRpc?.error ?? `OK ${oRpc?.jobs?.length ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
