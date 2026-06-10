#!/usr/bin/env node
/** Provisiona auth.users para perfiles teléfono sin Auth. npm run db:ensure-phone-auth */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

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

function pgLookup(hostname, _opts, callback) {
  dns.lookup(hostname, { family: 6, all: true }, (err6, addrs6) => {
    if (!err6 && addrs6?.length) return callback(null, addrs6[0].address, 6);
    dns.lookup(hostname, callback);
  });
}

loadEnv();
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
  const { rows: missing } = await db.query(`
    SELECT p.id, p.full_name, p.phone, p.role::text
    FROM profiles p
    WHERE p.phone IS NOT NULL AND trim(p.phone) <> ''
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
    ORDER BY p.role, p.full_name
  `);

  console.log(`Perfiles sin auth.users: ${missing.length}`);
  for (const p of missing) {
    const { rows } = await db.query(
      `SELECT ensure_phone_auth_user($1::uuid, $2) AS result`,
      [p.id, p.phone],
    );
    const r = rows[0]?.result;
    console.log(
      r?.success
        ? `✅ ${p.full_name} (${p.phone}) — ${r.created ? 'creado' : 'ya existía'}`
        : `❌ ${p.full_name}: ${r?.error ?? 'error'}`,
    );
  }

  const { rows: mamaPapa } = await db.query(`
    SELECT p.full_name, u.email
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE lower(p.full_name) LIKE '%mama%' OR lower(p.full_name) LIKE '%papa%'
  `);
  console.log('\nAuth mama/papa:', mamaPapa);
} finally {
  await db.end();
}
