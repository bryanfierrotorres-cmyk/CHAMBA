#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    if (!process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const pg = await import('pg');
const c = new pg.default.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query(`
  SELECT c.relname,
         CASE c.relreplident
           WHEN 'd' THEN 'default'
           WHEN 'f' THEN 'full'
           ELSE c.relreplident::text
         END AS replica_identity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'mensajes'
`);
const pub = await c.query(`
  SELECT tablename FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = 'mensajes'
`);
console.log('mensajes replica:', r.rows[0]);
console.log('in realtime pub:', pub.rows.length > 0);
await c.end();
