#!/usr/bin/env node
/** npm run db:apply-worker-wallet-sync */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SQL_PATH = join(ROOT, 'supabase', 'migrations', '052_worker_wallet_complete_sync.sql');
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

async function applyViaPg(sql) {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) return false;
  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();
  await db.query(sql);
  await db.end();
  return true;
}

async function main() {
  loadEnv();
  const sql = readFileSync(SQL_PATH, 'utf8');
  console.log('Aplicando 052_worker_wallet_complete_sync.sql…');
  await applyViaPg(sql);
  console.log('✅ Migración 052 aplicada');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
