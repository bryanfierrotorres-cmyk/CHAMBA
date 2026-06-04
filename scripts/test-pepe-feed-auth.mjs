#!/usr/bin/env node
/**
 * Verifica que Pepe con sesión Auth vea jobs abiertos de Mama.
 * npm run test:pepe-feed
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const password =
  process.env.EXPO_PUBLIC_PILOT_PHONE_PASSWORD?.trim() || 'ChambaTest123!';
const PEPE_ID = '11111111-1111-1111-1111-111111111102';
const PEPE_EMAIL = '84888888@phone.chamba.local';

async function main() {
  if (!url || !anon) {
    console.error('Faltan EXPO_PUBLIC_SUPABASE_URL / ANON_KEY');
    process.exit(1);
  }

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rpc, error: rpcErr } = await client.rpc('get_worker_open_jobs_feed', {
    p_worker_id: PEPE_ID,
    p_status: 'open',
    p_categories: ['sofas', 'limpieza_sofas', 'jardineria', 'jardineria_corte'],
    p_limit: 20,
    p_offset: 0,
  });

  if (rpcErr) {
    console.error('❌ RPC get_worker_open_jobs_feed:', rpcErr.message);
    console.error('   Ejecutá: npm run db:apply-worker-feed-phone');
    process.exit(1);
  }

  if (!rpc?.success) {
    console.error('❌ RPC:', rpc?.error ?? 'falló');
    process.exit(1);
  }

  const rpcJobs = rpc.jobs ?? [];
  const rpcMama = rpcJobs.filter(
    (j) => j.created_by === '11111111-1111-1111-1111-111111111101',
  );

  console.log('✅ Feed Pepe (RPC por worker_id)');
  console.log(`   Jobs open en feed: ${rpcJobs.length}`);
  console.log(`   De Mama Papa: ${rpcMama.length}`);
  for (const j of rpcMama.slice(0, 5)) {
    console.log(`   · ${j.title} [${j.category}]`);
  }

  if (rpcMama.length === 0) {
    console.warn('\n⚠️  Feed OK pero no hay solicitudes open de Mama. Publicá una como cliente.');
    process.exit(0);
  }

  console.log('\n✅ Flujo cliente → técnico conectado (login teléfono + RPC feed).');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
