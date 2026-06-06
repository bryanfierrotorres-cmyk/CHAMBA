#!/usr/bin/env node
/** npm run db:fix-job-category */
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
const sql = readFileSync(join(ROOT, 'supabase/migrations/030_job_category_text.sql'), 'utf8');
await c.query(sql);
const col = await c.query(`
  SELECT udt_name FROM information_schema.columns
  WHERE table_name = 'jobs' AND column_name = 'category'
`);
console.log('✅ 030 aplicada — jobs.category:', col.rows[0]?.udt_name);
await c.end();
