#!/usr/bin/env node
/** Aplica migración 045 — última ubicación técnico + distancia fallback. npm run db:apply-worker-location */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = '045_worker_last_location.sql';
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

function projectRefFromSupabaseUrl(url) {
  const m = url?.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

function normalizePgUrl(raw) {
  if (!raw) return null;
  const withProto = raw.startsWith('postgres://') ? raw : raw.replace(/^postgresql:/, 'postgres:');
  return new URL(withProto);
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

  const ref = projectRefFromSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);

  try {
    const direct = normalizePgUrl(raw);
    if (ref) {
      const d = new URL(direct.toString());
      d.hostname = `db.${ref}.supabase.co`;
      d.port = '5432';
      if (d.username?.startsWith('postgres.')) d.username = 'postgres';
      d.searchParams.delete('pgbouncer');
      push(d.toString(), 'directa db.<ref>.supabase.co:5432');
    }

    const session = new URL(direct.toString());
    if (session.port === '6543' || session.hostname.includes('pooler')) {
      session.port = '5432';
    }
    session.searchParams.delete('pgbouncer');
    push(session.toString(), 'pooler sesión :5432');
  } catch {
    push(raw.replace(':6543', ':5432'), 'fallback :5432');
  }

  return out;
}

function pgLookup(hostname, _opts, callback) {
  dns.lookup(hostname, { family: 6, all: true }, (err6, addrs6) => {
    if (!err6 && addrs6?.length) {
      const a = addrs6[0];
      return callback(null, a.address, 6);
    }
    dns.lookup(hostname, callback);
  });
}

async function connectWithRetries(Client, candidates, maxAttempts = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const { url, label } of candidates) {
      const db = new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 45_000,
        query_timeout: 120_000,
        lookup: pgLookup,
      });
      try {
        console.log(`Intento ${attempt}/${maxAttempts} — ${label}…`);
        await db.connect();
        return db;
      } catch (err) {
        lastErr = err;
        console.warn(`  ↳ ${err.message}`);
        try {
          await db.end();
        } catch {
          /* ignore */
        }
      }
    }
    if (attempt < maxAttempts) {
      const wait = attempt * 5000;
      console.log(`Reintento en ${wait / 1000}s…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr ?? new Error('No se pudo conectar a la base de datos');
}

async function applyViaManagementApi(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;

  console.log('Aplicando vía Management API…');
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
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${body.slice(0, 400)}`);
  }
  return true;
}

async function verifyMigration(dbOrNull) {
  const q = `
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'worker_profiles'
          AND column_name = 'last_lat'
      ) AS has_last_lat,
      EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'update_worker_last_location'
      ) AS has_update_rpc
  `;
  if (dbOrNull) {
    const { rows } = await dbOrNull.query(q);
    return rows[0];
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: q }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 400));
  const row = data?.result?.[0] ?? data?.[0];
  return row;
}

loadEnv();

const sqlPath = join(ROOT, 'supabase', 'migrations', MIGRATION);
const sql = readFileSync(sqlPath, 'utf8');
const candidates = buildDbUrlCandidates();
const hasAccessToken = !!process.env.SUPABASE_ACCESS_TOKEN;

if (candidates.length === 0 && !hasAccessToken) {
  console.error('❌ Configurá SUPABASE_DB_URL o SUPABASE_ACCESS_TOKEN en .env');
  process.exit(1);
}

const pg = await import('pg');
const Client = pg.default?.Client ?? pg.Client;

let db;
try {
  if (hasAccessToken) {
    await applyViaManagementApi(sql);
  } else {
    try {
      db = await connectWithRetries(Client, candidates, 2);
      console.log(`Aplicando ${MIGRATION}…`);
      await db.query(sql);
    } catch (pgErr) {
      const viaApi = await applyViaManagementApi(sql);
      if (!viaApi) throw pgErr;
    }
  }
  const check = await verifyMigration(db);
  const okLat = check?.has_last_lat === true || check?.has_last_lat === 't';
  const okRpc = check?.has_update_rpc === true || check?.has_update_rpc === 't';
  if (!okLat || !okRpc) {
    throw new Error(`Verificación falló: ${JSON.stringify(check)}`);
  }
  console.log('✅ Migración 045 aplicada — worker_profiles.last_lat/lng + update_worker_last_location');
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
} finally {
  if (db) await db.end();
}
