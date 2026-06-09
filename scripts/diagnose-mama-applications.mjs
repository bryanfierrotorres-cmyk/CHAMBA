#!/usr/bin/env node
/**
 * Diagnóstico: postulaciones visibles para cliente Mama Mama
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

  const { rows: clients } = await db.query(`
    SELECT id, full_name, phone, role
    FROM profiles
    WHERE full_name ILIKE '%mama%' OR phone LIKE '%88888888%'
    ORDER BY full_name
  `);

  console.log('=== Perfiles Mama ===');
  for (const c of clients) {
    console.log(`  ${c.full_name} | ${c.phone} | ${c.id}`);
  }

  const mamaIds = clients.map((c) => c.id);

  const { rows: jobs } = await db.query(`
    SELECT j.id, j.title, j.status, j.created_by, j.created_at,
           p.full_name AS creator_name, p.phone AS creator_phone
    FROM jobs j
    JOIN profiles p ON p.id = j.created_by
    WHERE j.created_by = ANY($1::uuid[])
       OR p.full_name ILIKE '%mama%'
    ORDER BY j.created_at DESC
    LIMIT 10
  `, [mamaIds]);

  console.log('\n=== Jobs Mama (últimos 10) ===');
  for (const j of jobs) {
    console.log(`\nJob: ${j.title}`);
    console.log(`  id: ${j.id}`);
    console.log(`  status: ${j.status}`);
    console.log(`  created_by: ${j.created_by} (${j.creator_name})`);

    const { rows: apps } = await db.query(`
      SELECT ja.id, ja.worker_id, ja.selection_status, ja.assigned_at,
             p.full_name AS worker_name
      FROM job_assignments ja
      JOIN profiles p ON p.id = ja.worker_id
      WHERE ja.job_id = $1
      ORDER BY ja.assigned_at
    `, [j.id]);

    if (apps.length === 0) {
      console.log('  postulaciones: (ninguna en BD)');
    } else {
      console.log(`  postulaciones: ${apps.length}`);
      for (const a of apps) {
        console.log(`    - ${a.worker_name} | ${a.selection_status} | ${a.id}`);
      }
    }

    for (const clientId of mamaIds.length ? mamaIds : [j.created_by]) {
      const supabase = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase.rpc('get_job_worker_applications', {
        p_job_id: j.id,
        p_client_id: clientId,
      });
      const body = data;
      const label = clients.find((c) => c.id === clientId)?.full_name ?? clientId;
      if (error) {
        console.log(`  RPC get_job_worker_applications(${label}): ERROR ${error.message}`);
      } else if (!body?.success) {
        console.log(`  RPC get_job_worker_applications(${label}): FAIL ${body?.error}`);
      } else {
        console.log(`  RPC get_job_worker_applications(${label}): OK → ${body.applications?.length ?? 0} apps`);
      }
    }
  }

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
