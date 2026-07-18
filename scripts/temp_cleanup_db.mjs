import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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
const dbUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!dbUrl) {
  console.error('❌ Define SUPABASE_DB_URL en .env');
  process.exit(1);
}

const db = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  await db.connect();
  console.log('Connected to DB. Running cleanup SQL...');

  const sql = `
    DELETE FROM job_assignments;
    DELETE FROM jobs;
  `;

  await db.query(sql);
  console.log('✅ DB jobs and assignments cleaned up successfully!');
  await db.end();
}

main().catch(console.error);
