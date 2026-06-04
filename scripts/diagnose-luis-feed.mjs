#!/usr/bin/env node
/**
 * Diagnóstico: por qué un técnico (ej. Luis Papa) no ve jobs abiertos.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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

const dbUrl = process.env.SUPABASE_DB_URL;
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const WORKER_SEARCH = process.argv[2] || 'luis';

async function main() {
  let Client;
  const pg = await import('pg');
  Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  console.log('\n=== PERFILES (nombre ~ luis / papa) ===');
  const profiles = await db.query(`
    SELECT id, full_name, phone, role::text, is_approved,
           category_1, category_1_approved, category_2, category_2_approved
    FROM profiles
    WHERE lower(full_name) LIKE $1 OR phone LIKE $2
    ORDER BY role, full_name
  `, [`%${WORKER_SEARCH.toLowerCase()}%`, `%${WORKER_SEARCH}%`]);
  console.table(profiles.rows);

  console.log('\n=== ÚLTIMOS 10 JOBS (cualquier estado) ===');
  const jobs = await db.query(`
    SELECT id, title, category::text, status::text, created_by, created_at
    FROM jobs ORDER BY created_at DESC LIMIT 10
  `);
  console.table(jobs.rows);

  console.log('\n=== JOBS ABIERTOS ===');
  const open = await db.query(`
    SELECT id, title, category::text, created_by, created_at
    FROM jobs WHERE status::text = 'open' ORDER BY created_at DESC
  `);
  console.table(open.rows);

  console.log('\n=== POLÍTICAS RLS en jobs ===');
  const pol = await db.query(`
    SELECT policyname, cmd, qual::text
    FROM pg_policies WHERE tablename = 'jobs'
  `);
  for (const p of pol.rows) {
    console.log(`- ${p.policyname} (${p.cmd})`);
  }

  console.log('\n=== RPC get_open_jobs_feed ===');
  const rpc = await db.query(`SELECT proname FROM pg_proc WHERE proname = 'get_open_jobs_feed'`);
  console.log(rpc.rows.length ? 'OK' : 'NO EXISTE');

  const luis = profiles.rows.find(
    (r) => r.role === 'worker' && r.full_name?.toLowerCase().includes('luis'),
  ) ?? profiles.rows.find((r) => r.role === 'worker');

  if (luis && open.rows.length > 0) {
    console.log('\n=== MATCH categoría técnico vs jobs abiertos ===');
    const approved = [];
    if (luis.category_1 && luis.category_1_approved) approved.push(luis.category_1);
    if (luis.category_2 && luis.category_2_approved) approved.push(luis.category_2);
    console.log('Técnico:', luis.full_name, '| aprobado:', luis.is_approved);
    console.log('Categorías aprobadas:', approved.length ? approved.join(', ') : '(ninguna)');

    for (const j of open.rows) {
      const match = approved.length === 0
        ? 'SIN CAT → feed app vacío si pilot off'
        : approved.includes(j.category)
          ? 'VISIBLE'
          : `OCULTO (job=${j.category})`;
      console.log(`  ${j.title?.slice(0, 40)} → ${match}`);
    }
  }

  await db.end();

  if (url && serviceKey && luis) {
    console.log('\n=== SIMULACIÓN: SELECT jobs como técnico (service role bypass) ===');
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: allOpen } = await admin.from('jobs').select('id,title,category,status').eq('status', 'open');
    console.log('Jobs open (admin):', allOpen?.length ?? 0);

    if (anonKey) {
      console.log('\n=== SELECT jobs con anon (sin sesión técnico) ===');
      const anon = createClient(url, anonKey);
      const { data: anonJobs, error } = await anon.from('jobs').select('id').eq('status', 'open');
      console.log('Anon ve:', anonJobs?.length ?? 0, error?.message ?? '');
    }
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
