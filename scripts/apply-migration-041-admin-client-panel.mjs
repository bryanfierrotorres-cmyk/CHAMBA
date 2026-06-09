#!/usr/bin/env node
/** Aplica migración 041 — RPC paneles admin/cliente. npm run db:apply-admin-client-panel */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SQL_PATH = join(ROOT, 'supabase', 'migrations', '041_admin_client_panel_rpc.sql');

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

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ SUPABASE_DB_URL no configurado');
  process.exit(1);
}

const sql = readFileSync(SQL_PATH, 'utf8');
const pg = await import('pg');
const Client = pg.default?.Client ?? pg.Client;
const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await db.connect();
  await db.query(sql);
  console.log('✅ Migración 041 aplicada — get_admin_control_jobs + get_client_orders_panel');
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
} finally {
  await db.end();
}
