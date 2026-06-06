#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = '023_job_chat_mensajes.sql';

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

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ SUPABASE_DB_URL en .env');
  process.exit(1);
}

async function main() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(readFileSync(join(ROOT, 'supabase', 'migrations', MIGRATION), 'utf8'));
  const { rows } = await client.query(`
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensajes'
  `);
  await client.end();
  console.log(rows.length ? '✅ Tabla mensajes + realtime OK' : '⚠️ Revisar publication mensajes en dashboard');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
