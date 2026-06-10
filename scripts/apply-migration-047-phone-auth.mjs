#!/usr/bin/env node
/** npm run db:apply-phone-auth-provision */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = '047_phone_auth_provision.sql';

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
const raw = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const url = raw?.replace(':6543', ':5432').replace('postgresql:', 'postgres:');
const db = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  lookup: pgLookup,
});
await db.connect();
try {
  console.log(`Aplicando ${MIGRATION}…`);
  await db.query(sql);
  const { rows } = await db.query(
    `SELECT proname FROM pg_proc WHERE proname = 'ensure_phone_auth_user'`,
  );
  if (!rows.length) throw new Error('RPC no creada');
  console.log('✅ Migración 047 aplicada');
} finally {
  await db.end();
}
