#!/usr/bin/env node
/**
 * Aplica migraciones CHAMBA en la base remota.
 * Requiere en .env: SUPABASE_DB_URL
 *
 * npm run db:sync-chamba
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MIGRATIONS = [
  '001_add_availability_status.sql',
  '005_chamba_complete_fix.sql',
  '009_pilot_worker_agenda.sql',
  '007_worker_reviews.sql',
];

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
  console.error('❌ Define SUPABASE_DB_URL en .env');
  console.error('   Supabase → Project Settings → Database → Connection string (URI)');
  process.exit(1);
}

async function main() {
  let Client;
  try {
    const pg = await import('pg');
    Client = pg.default?.Client ?? pg.Client;
  } catch {
    console.error('❌ npm install pg --save-dev');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const file of MIGRATIONS) {
    const sqlPath = join(ROOT, 'supabase', 'migrations', file);
    if (!existsSync(sqlPath)) {
      console.warn(`⚠ Omitido (no existe): ${file}`);
      continue;
    }
    console.log(`Aplicando ${file}…`);
    await client.query(readFileSync(sqlPath, 'utf8'));
  }

  await client.end();
  console.log('✅ Migraciones CHAMBA aplicadas.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
