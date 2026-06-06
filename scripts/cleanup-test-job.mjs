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
    if (!process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv();
const pg = await import('pg');
const c = new pg.default.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query(`DELETE FROM jobs WHERE id = 'f9a3ec06-5192-47e1-bde1-e4a89491218a'`);
const r = await c.query(`
  SELECT id, title, status FROM jobs
  WHERE created_by = 'cb92c728-f64f-4e9c-9c0b-aef479375e02'
    AND status NOT IN ('completed', 'cancelled')
`);
console.log('Solicitudes activas mama mama:');
console.table(r.rows);
await c.end();
