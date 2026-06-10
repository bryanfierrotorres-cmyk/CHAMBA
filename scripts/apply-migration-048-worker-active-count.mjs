#!/usr/bin/env node
/** npm run db:apply-worker-active-count-orphans */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SQL_PATH = join(ROOT, 'supabase', 'migrations', '048_worker_active_count_orphans.sql');
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
loadEnv();

const sql = readFileSync(SQL_PATH, 'utf8');

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    const pg = await import('pg');
    const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
      await db.connect();
      await db.query(sql);
      console.log('✅ Migración 048 aplicada');
      return;
    } catch (err) {
      console.warn('Postgres:', err.message);
      try { await db.end(); } catch { /* ignore */ }
    }
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Sin SUPABASE_DB_URL ni SUPABASE_ACCESS_TOKEN');
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  console.log('✅ Migración 048 aplicada (Management API)');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
