#!/usr/bin/env node
/** Diagnóstico: asignaciones de Pepe en BD vs RPC con/sin Auth */
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

const dbUrl = process.env.SUPABASE_DB_URL;
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.EXPO_PUBLIC_PILOT_PHONE_PASSWORD?.trim() || 'ChambaTest123!';

async function main() {
  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: workers } = await db.query(`
    SELECT id, full_name, phone, is_approved
    FROM profiles
    WHERE phone = '84888888' OR full_name ILIKE '%pepe%' OR full_name ILIKE '%papa%'
    ORDER BY phone NULLS LAST
  `);
  console.log('\n=== Perfiles Pepe/papa ===');
  for (const w of workers) console.log(w);

  for (const w of workers.filter((x) => x.phone === '84888888')) {
    const { rows: assigns } = await db.query(
      `
      SELECT j.title, j.status, ja.selection_status, j.assigned_worker_id = ja.worker_id AS is_assigned
      FROM job_assignments ja
      JOIN jobs j ON j.id = ja.job_id
      WHERE ja.worker_id = $1
        AND j.status IN ('open','taken','in_progress')
      ORDER BY ja.assigned_at DESC
      `,
      [w.id],
    );
    console.log(`\n=== BD activas ${w.full_name} (${w.id}) ===`);
    for (const a of assigns) {
      console.log(`  ${a.status} | ${a.selection_status} | assigned_ok=${a.is_assigned} | ${a.title}`);
    }
  }

  if (url && anon) {
    const pepe = workers.find((w) => w.phone === '84888888');
    if (pepe) {
      const sb = createClient(url, anon, { auth: { persistSession: false } });
      const email = `${pepe.phone}@phone.chamba.local`;

      const { data: anonRpc, error: anonErr } = await sb.rpc('get_worker_assignments', { p_worker_id: pepe.id });
      if (anonErr) console.log('RPC anon ERROR:', anonErr.message);
      const anonArr = Array.isArray(anonRpc) ? anonRpc : (typeof anonRpc === 'string' ? JSON.parse(anonRpc) : []);
      console.log(`\n=== RPC anon (Supabase JS) → ${anonArr.length} filas ===`);
      for (const row of anonArr.filter((r) => ['open', 'taken', 'in_progress'].includes(r.job?.status)).slice(0, 6)) {
        console.log(`  ${row.job?.status} | ${row.selection_status} | ${row.job?.title}`);
      }

      const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({ email, password });
      if (signErr) {
        console.log('Auth signIn FAIL:', signErr.message);
      } else {
        console.log('Auth OK uid=', signIn.user?.id, 'match profile=', signIn.user?.id === pepe.id);
        const { data: authRpc, error: rpcErr } = await sb.rpc('get_worker_assignments', { p_worker_id: pepe.id });
        if (rpcErr) console.log('RPC con auth ERROR:', rpcErr.message);
        else {
          const arr = Array.isArray(authRpc) ? authRpc : [];
          console.log(`RPC con auth → ${arr.length} filas`);
          for (const row of arr.filter((r) => ['open', 'taken', 'in_progress'].includes(r.job?.status)).slice(0, 6)) {
            console.log(`  ${row.job?.status} | ${row.selection_status} | ${row.job?.title}`);
          }
        }

        const wrongId = '11111111-1111-1111-1111-111111111102';
        const { data: wrongRpc } = await sb.rpc('get_worker_assignments', { p_worker_id: wrongId });
        const wrongArr = Array.isArray(wrongRpc) ? wrongRpc : [];
        console.log(`RPC con auth pero p_worker_id VIEJO (${wrongId.slice(0, 8)}…) → ${wrongArr.length} filas (esperado 0)`);
      }
    }
  }

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
