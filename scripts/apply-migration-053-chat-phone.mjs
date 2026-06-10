#!/usr/bin/env node
/** npm run db:apply-chat-phone-fix */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SQL_PATH = join(ROOT, 'supabase', 'migrations', '053_chat_phone_participant_fix.sql');

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

async function main() {
  loadEnv();
  const sql = readFileSync(SQL_PATH, 'utf8');
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('SUPABASE_DB_URL required');
    process.exit(1);
  }
  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('Aplicando 053_chat_phone_participant_fix.sql…');
  await db.query(sql);
  await db.end();
  console.log('✅ Migración 053 aplicada');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
