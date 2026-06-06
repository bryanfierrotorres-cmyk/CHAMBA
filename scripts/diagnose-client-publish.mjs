#!/usr/bin/env node
/** Diagnóstico publicación cliente: perfiles, jobs, RPC create_client_job */
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

async function main() {
  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: profiles } = await db.query(`
    SELECT id, full_name, phone, role::text, is_approved
    FROM profiles ORDER BY created_at DESC NULLS LAST LIMIT 10
  `);
  console.log('\n── Perfiles ──');
  console.table(profiles);

  const { rows: jobs } = await db.query(`
    SELECT id, title, status, created_by FROM jobs ORDER BY created_at DESC LIMIT 5
  `);
  console.log('\n── Jobs ──');
  console.table(jobs);

  const client = profiles.find((p) => p.role === 'client');
  if (!client || !url || !anon) {
    await db.end();
    return;
  }

  const supabase = createClient(url, anon);
  const { data: count } = await supabase.rpc('count_client_active_jobs', {
    p_client_id: client.id,
  });
  console.log('\nActive jobs count for', client.full_name, ':', count);

  for (const cat of ['limpieza_sofas', 'sofas', 'ac_mantenimiento', 'conserjeria_ocasional']) {
    const { data: rpc, error } = await supabase.rpc('create_client_job', {
      p_created_by: client.id,
      p_title: `[diag] ${cat}`,
      p_description: 'Descripción de prueba con más de diez caracteres.',
      p_category: cat,
      p_pay_amount: 500,
      p_address: 'Managua test',
      p_lat: 0,
      p_lng: 0,
      p_duration_hours: 2,
      p_required_workers: 1,
      p_media_urls: [],
    });
    console.log('try', cat, ':', error?.message ?? rpc?.error ?? rpc?.success);
    if (rpc?.success && rpc?.job?.id) {
      await db.query(`DELETE FROM jobs WHERE id = $1`, [rpc.job.id]);
    }
  }

  await db.end();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
