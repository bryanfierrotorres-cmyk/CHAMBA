#!/usr/bin/env node
/** npm run db:apply-worker-agenda-sync — migración 046 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = '046_worker_agenda_sync_fix.sql';

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

function buildDbUrlCandidates() {
  const out = [];
  const seen = new Set();
  const push = (url, label) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ url, label });
  };
  push(process.env.SUPABASE_DB_DIRECT_URL, 'SUPABASE_DB_DIRECT_URL');
  const raw = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!raw) return out;
  try {
    const session = new URL(raw.startsWith('postgres://') ? raw : raw.replace(/^postgresql:/, 'postgres:'));
    if (session.port === '6543' || session.hostname.includes('pooler')) session.port = '5432';
    session.searchParams.delete('pgbouncer');
    push(session.toString(), 'pooler :5432');
  } catch {
    push(raw.replace(':6543', ':5432'), 'fallback');
  }
  return out;
}

function pgLookup(hostname, _opts, callback) {
  dns.lookup(hostname, { family: 6, all: true }, (err6, addrs6) => {
    if (!err6 && addrs6?.length) return callback(null, addrs6[0].address, 6);
    dns.lookup(hostname, callback);
  });
}

loadEnv();
const sql = readFileSync(join(ROOT, 'supabase', 'migrations', MIGRATION), 'utf8');
const pg = await import('pg');
const Client = pg.default?.Client ?? pg.Client;
const candidates = buildDbUrlCandidates();
if (candidates.length === 0) {
  console.error('❌ SUPABASE_DB_URL requerido');
  process.exit(1);
}

let db;
for (const { url, label } of candidates) {
  db = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 45_000,
    lookup: pgLookup,
  });
  try {
    console.log(`Conectando (${label})…`);
    await db.connect();
    break;
  } catch (e) {
    console.warn(e.message);
    db = null;
  }
}
if (!db) {
  console.error('❌ No se pudo conectar');
  process.exit(1);
}

try {
  console.log(`Aplicando ${MIGRATION}…`);
  await db.query(sql);
  const { rows } = await db.query(`
    SELECT proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND proname = 'fn_profiles_same_phone'
  `);
  if (!rows.length) throw new Error('fn_profiles_same_phone no creada');
  console.log('✅ Migración 046 aplicada');
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
} finally {
  await db.end();
}
