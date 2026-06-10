#!/usr/bin/env node
/** Diagnóstico mama mama → papa papa agenda sync */
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

const password = process.env.EXPO_PUBLIC_PILOT_PHONE_PASSWORD?.trim() || 'ChambaTest123!';

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!dbUrl) {
    console.error('SUPABASE_DB_URL required');
    process.exit(1);
  }

  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: profiles } = await db.query(`
    SELECT id, full_name, phone, role::text, is_approved, email
    FROM profiles
    WHERE lower(full_name) LIKE '%mama%'
       OR lower(full_name) LIKE '%papa%'
       OR phone IN ('88888888', '84888888')
    ORDER BY role, full_name
  `);

  console.log('\n=== PERFILES mama/papa ===');
  console.table(profiles);

  const clients = profiles.filter((p) => p.role === 'client');
  const workers = profiles.filter((p) => p.role === 'worker');

  for (const p of profiles) {
    const phoneDigits = (p.phone || '').replace(/\D/g, '');
    const { rows: auth } = await db.query(
      `SELECT id, email FROM auth.users
       WHERE id = $1::uuid OR email ILIKE $2`,
      [p.id, `%${phoneDigits}%`],
    );
    console.log(`Auth ${p.full_name}:`, auth.length ? auth : '(sin auth.users)');
  }

  for (const worker of workers) {
    console.log(`\n=== BD assignments ${worker.full_name} (${worker.id}) ===`);
    const { rows: assigns } = await db.query(
      `
      SELECT j.title, j.status::text, ja.selection_status,
             j.assigned_worker_id = ja.worker_id AS assigned_match,
             j.created_by, (SELECT full_name FROM profiles WHERE id = j.created_by) AS client
      FROM job_assignments ja
      JOIN jobs j ON j.id = ja.job_id
      WHERE ja.worker_id = $1
      ORDER BY ja.assigned_at DESC
      LIMIT 15
      `,
      [worker.id],
    );
    if (!assigns.length) console.log('  (ninguna)');
    else console.table(assigns);

    const { rows: rpcDirect } = await db.query(
      'SELECT get_worker_assignments($1::uuid) AS data',
      [worker.id],
    );
    const direct = rpcDirect[0]?.data;
    const directArr = Array.isArray(direct) ? direct : [];
    console.log(`RPC SQL direct (sin JWT): ${directArr.length} filas`);

    if (url && anon && worker.phone) {
      const sb = createClient(url, anon, { auth: { persistSession: false } });
      const phoneDigits = worker.phone.replace(/\D/g, '');
      const email = worker.email?.includes('@')
        ? worker.email
        : `${phoneDigits}@phone.chamba.local`;

      const { error: signErr, data: signIn } = await sb.auth.signInWithPassword({ email, password });
      if (signErr) {
        console.log(`Auth signIn ${worker.full_name}: FAIL — ${signErr.message} (${email})`);
        continue;
      }
      const uid = signIn.user?.id;
      console.log(`Auth ${worker.full_name}: uid=${uid} match_profile=${uid === worker.id}`);

      const { data: rpcAuth, error: rpcErr } = await sb.rpc('get_worker_assignments', {
        p_worker_id: worker.id,
      });
      if (rpcErr) console.log('RPC JS error:', rpcErr.message);
      const arr = Array.isArray(rpcAuth) ? rpcAuth : [];
      console.log(`RPC con auth (profile id): ${arr.length} filas`);
      for (const row of arr.filter((r) => ['open', 'taken', 'in_progress'].includes(r.job?.status)).slice(0, 8)) {
        console.log(`  · ${row.job?.status} | ${row.selection_status} | ${row.job?.title}`);
      }

      if (uid && uid !== worker.id) {
        const { data: rpcWrong } = await sb.rpc('get_worker_assignments', { p_worker_id: uid });
        const wrongArr = Array.isArray(rpcWrong) ? rpcWrong : [];
        console.log(`RPC con auth.uid() como p_worker_id: ${wrongArr.length} filas`);
      }
    }
  }

  for (const client of clients) {
    console.log(`\n=== Jobs de ${client.full_name} (${client.id}) ===`);
    const { rows: jobs } = await db.query(
      `
      SELECT j.id, j.title, j.status::text, j.assigned_worker_id,
             (SELECT full_name FROM profiles WHERE id = j.assigned_worker_id) AS worker_name
      FROM jobs j
      WHERE j.created_by = $1
      ORDER BY j.updated_at DESC NULLS LAST
      LIMIT 10
      `,
      [client.id],
    );
    console.table(jobs);

    for (const j of jobs.filter((x) => x.status === 'taken' || x.status === 'in_progress')) {
      const wid = j.assigned_worker_id;
      if (!wid) continue;
      const worker = profiles.find((p) => p.id === wid);
      console.log(`\n  Job taken "${j.title}" → worker ${worker?.full_name ?? wid}`);
      if (worker && url && anon) {
        const sb = createClient(url, anon, { auth: { persistSession: false } });
        const phoneDigits = (worker.phone || '').replace(/\D/g, '');
        const email = worker.email?.includes('@')
          ? worker.email
          : `${phoneDigits}@phone.chamba.local`;
        await sb.auth.signInWithPassword({ email, password });
        const { data: rpc } = await sb.rpc('get_worker_assignments', { p_worker_id: worker.id });
        const found = (Array.isArray(rpc) ? rpc : []).some((r) => r.job_id === j.id);
        console.log(`  ¿Aparece en agenda RPC de ${worker.full_name}? ${found ? 'SÍ' : 'NO'}`);
      }
    }
  }

  const { rows: fnCheck } = await db.query(`
    SELECT proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND proname = 'fn_profiles_same_phone'
  `);
  console.log('\nMigración 046 fn_profiles_same_phone:', fnCheck.length ? 'OK' : 'FALTA');

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
