#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const dbUrl = process.env.SUPABASE_DB_URL;
const pg = await import('pg');
const c = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`SELECT polname, cmd, with_check FROM pg_policies WHERE tablename='mensajes'`);
console.log(r.rows);
const f = await c.query(`SELECT pg_get_functiondef(oid) def FROM pg_proc WHERE proname='send_job_chat_message' LIMIT 1`);
console.log(f.rows[0]?.def?.includes('row_security') ? 'has row_security in def' : 'no row_security');
await c.end();
