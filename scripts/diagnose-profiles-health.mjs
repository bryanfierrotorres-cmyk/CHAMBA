#!/usr/bin/env node
/** Diagnóstico: perfiles en BD + RPC get_profile_by_phone. npm run diagnose:profiles */
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
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

async function main() {
  console.log('\n=== CHAMBA — diagnóstico perfiles ===\n');

  if (url && anonKey) {
    const sb = createClient(url, anonKey);
    const { data: rpcOk, error: rpcErr } = await sb.rpc('get_profile_by_phone', {
      p_phone: '00000000',
    });
    console.log('RPC get_profile_by_phone (test):', rpcErr ? `ERROR ${rpcErr.message}` : 'OK');

    for (const fn of ['get_admin_control_jobs', 'get_admin_team_profiles']) {
      const { error } = await sb.rpc(fn, { p_admin_id: '00000000-0000-4000-8000-000000000000' });
      console.log(`RPC ${fn}:`, error ? `MISSING/ERR ${error.message}` : 'OK');
    }
  } else {
    console.log('Sin EXPO_PUBLIC_SUPABASE_URL/ANON_KEY');
  }

  if (dbUrl) {
    const pg = await import('pg');
    const Client = pg.default?.Client ?? pg.Client;
    const db = new Client({
      connectionString: dbUrl.replace(':6543', ':5432'),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20_000,
    });
    try {
      await db.connect();
      const { rows: counts } = await db.query(`
        SELECT role::text, COUNT(*)::int AS n,
               SUM(CASE WHEN is_approved THEN 1 ELSE 0 END)::int AS approved
        FROM profiles
        GROUP BY role
        ORDER BY role
      `);
      console.log('\nConteo profiles (BD directa):');
      for (const r of counts) {
        console.log(`  ${r.role}: ${r.n} (${r.approved} aprobados)`);
      }
      const { rows: recent } = await db.query(`
        SELECT full_name, phone, role::text, is_approved, created_at
        FROM profiles
        ORDER BY created_at DESC
        LIMIT 8
      `);
      console.log('\nÚltimos perfiles:');
      for (const r of recent) {
        console.log(`  ${r.full_name} | ${r.phone} | ${r.role} | approved=${r.is_approved}`);
      }
    } catch (e) {
      console.log('\nBD directa:', e.message);
    } finally {
      try {
        await db.end();
      } catch {
        /* ignore */
      }
    }
  } else {
    console.log('Sin SUPABASE_DB_URL');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
