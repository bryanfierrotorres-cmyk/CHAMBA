#!/usr/bin/env node
/** Aplica migración 049 — RPC worker_advance_operational_phase. npm run db:apply-worker-advance-phase */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SQL_PATH = join(ROOT, 'supabase', 'migrations', '049_worker_advance_operational_phase_rpc.sql');
const PROJECT_REF = 'twsrthtyaglpymdfdtdp';

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

async function applyViaManagementApi(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 400)}`);
  return true;
}

async function verify(client) {
  const { rows } = await client.query(`
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'worker_advance_operational_phase'
  `);
  return rows;
}

loadEnv();

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const sql = readFileSync(SQL_PATH, 'utf8');

async function main() {
  if (dbUrl) {
    const pg = await import('pg');
    const Client = pg.default?.Client ?? pg.Client;
    const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
      await db.connect();
      await db.query(sql);
      const rows = await verify(db);
      await db.end();
      console.log('✅ Migración 049 aplicada (Postgres directo)');
      console.log('RPC:', rows[0] ?? '(no encontrada)');
      return;
    } catch (err) {
      console.warn('Postgres:', err.message);
      try {
        await db.end();
      } catch {
        /* ignore */
      }
    }
  }

  const ok = await applyViaManagementApi(sql);
  if (!ok) {
    console.error('❌ Necesitas SUPABASE_DB_URL o SUPABASE_ACCESS_TOKEN en .env');
    process.exit(1);
  }
  console.log('✅ Migración 049 aplicada (Management API)');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
