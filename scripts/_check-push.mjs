import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv();
const pg = await import('pg');
const c = new pg.default.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const t = await c.query(`SELECT 1 FROM pg_trigger tg JOIN pg_class cl ON cl.oid=tg.tgrelid WHERE cl.relname='jobs' AND tg.tgname='jobs_insert_notify_workers'`);
const w = await c.query(`SELECT full_name, CASE WHEN fcm_token IS NOT NULL AND length(trim(fcm_token))>0 THEN true ELSE false END AS has_token FROM profiles WHERE role='worker'`);
await c.end();
console.log('trigger_ok:', t.rowCount > 0);
console.log('workers:', JSON.stringify(w.rows));
