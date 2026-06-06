#!/usr/bin/env node
/** Simula createJob como la app (RPC + fallback insert) */
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
    if (!process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, anon);

const pg = await import('pg');
const db = new pg.default.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();
const { rows: clients } = await db.query(
  `SELECT id, full_name, phone FROM profiles WHERE role::text = 'client' LIMIT 1`,
);
await db.end();

if (!clients.length) {
  console.log('No hay clientes en BD');
  process.exit(0);
}

const client = clients[0];
const payload = {
  p_created_by: client.id,
  p_title: 'Solicitud de prueba debug',
  p_description: 'Descripción de prueba con más de diez caracteres para publicar.',
  p_category: 'limpieza_sofas',
  p_pay_amount: 1400,
  p_address: 'Managua, Nicaragua',
  p_lat: 0,
  p_lng: 0,
  p_duration_hours: 2,
  p_required_workers: 1,
  p_media_urls: [],
};

console.log('Cliente:', client.full_name, client.id);

const { data, error } = await supabase.rpc('create_client_job', payload);
console.log('\nRPC create_client_job:');
console.log('  error:', error ? JSON.stringify(error, null, 2) : null);
console.log('  data:', JSON.stringify(data, null, 2));

if (data?.success && data?.job?.id) {
  await (async () => {
    const c = new pg.default.Client({
      connectionString: process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
    });
    await c.connect();
    await c.query('DELETE FROM jobs WHERE id = $1', [data.job.id]);
    await c.end();
    console.log('\n(job de prueba eliminado)');
  })();
}

// Direct insert fallback (como createJob)
const { data: ins, error: insErr } = await supabase.from('jobs').insert({
  title: payload.p_title,
  description: payload.p_description,
  category: payload.p_category,
  pay_amount: payload.p_pay_amount,
  platform_fee: 70,
  worker_payout: 1330,
  address: payload.p_address,
  lat: 0,
  lng: 0,
  duration_hours: 2,
  required_workers: 1,
  media_urls: [],
  created_by: client.id,
  status: 'open',
}).select().single();

console.log('\nDirect INSERT jobs:');
console.log('  error:', insErr ? JSON.stringify(insErr, null, 2) : null);
console.log('  ok:', !!ins);
if (ins?.id) {
  const c = new pg.default.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query('DELETE FROM jobs WHERE id = $1', [ins.id]);
  await c.end();
}
