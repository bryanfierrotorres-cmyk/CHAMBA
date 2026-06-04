#!/usr/bin/env node
/**
 * Aplica 016_client_worker_selection.sql (postulaciones + elección del cliente).
 * Requiere SUPABASE_DB_URL en .env
 *
 * npm run db:apply-client-selection
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MIGRATION = '016_client_worker_selection.sql';

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
  console.error('❌ Define SUPABASE_DB_URL en .env (Database → Connection string URI)');
  process.exit(1);
}

async function main() {
  let Client;
  try {
    const pg = await import('pg');
    Client = pg.default?.Client ?? pg.Client;
  } catch {
    console.error('❌ Instala pg: npm install pg --save-dev');
    process.exit(1);
  }

  const sqlPath = join(ROOT, 'supabase', 'migrations', MIGRATION);
  if (!existsSync(sqlPath)) {
    console.error(`❌ No existe ${sqlPath}`);
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Aplicando ${MIGRATION}…`);
  await client.query(readFileSync(sqlPath, 'utf8'));

  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'job_assignments' AND column_name = 'selection_status'
  `);
  const { rows: rpc } = await client.query(`
    SELECT proname FROM pg_proc
    WHERE proname IN (
      'accept_job',
      'get_job_worker_applications',
      'client_approve_worker_application',
      'client_reject_worker_application'
    )
  `);

  await client.end();

  console.log('✅ Migración aplicada.');
  console.log('   Columna selection_status:', cols.length > 0 ? 'OK' : 'NO');
  console.log('   RPCs:', rpc.map((r) => r.proname).join(', ') || '(ninguna)');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
