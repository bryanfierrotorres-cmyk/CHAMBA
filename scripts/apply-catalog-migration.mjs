#!/usr/bin/env node
/**
 * Aplica migración 010 (catálogo dinámico) en partes — evita timeout del SQL Editor.
 *
 * Requiere en .env:
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...pooler.supabase.com:6543/postgres
 *
 * npm run db:apply-catalog
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PARTS = [
  '010_part1_tables.sql',
  '010_part2_seed.sql',
  '010_part3_rls.sql',
  '010_part4_functions.sql',
];

function loadEnvFile(name) {
  const envPath = join(ROOT, name);
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

loadEnvFile('.env');
loadEnvFile('.env.local');

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Falta SUPABASE_DB_URL en .env o .env.local');
  console.error('   Supabase Dashboard → Project Settings → Database → Connection string (URI)');
  console.error('   Usa el modo "Session" o "Transaction" pooler (puerto 6543).');
  process.exit(1);
}

async function runPart(client, file) {
  const sqlPath = join(ROOT, 'supabase', 'migrations', file);
  if (!existsSync(sqlPath)) throw new Error(`No existe: ${file}`);
  const sql = readFileSync(sqlPath, 'utf8');
  console.log(`\n▶ ${file} …`);
  await client.query('SET statement_timeout = 300000');
  await client.query(sql);
  console.log(`✓ ${file}`);
}

async function verify(client) {
  const cats = await client.query('SELECT COUNT(*)::int AS n FROM service_categories');
  const types = await client.query('SELECT COUNT(*)::int AS n FROM service_types');
  let rpcOk = false;
  try {
    const { rows } = await client.query(
      `SELECT jsonb_array_length((get_active_catalog()->'categories')) AS c,
              jsonb_array_length((get_active_catalog()->'service_types')) AS t`,
    );
    rpcOk = true;
    console.log(`\n✅ Catálogo: ${cats.rows[0].n} categorías, ${types.rows[0].n} tipos`);
    console.log(`   RPC get_active_catalog: ${rows[0].c} categorías, ${rows[0].t} tipos`);
  } catch (e) {
    console.log(`\n⚠ Tablas: ${cats.rows[0].n} categorías, ${types.rows[0].n} tipos`);
    console.log(`   RPC aún no disponible: ${e.message}`);
  }
  return rpcOk;
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

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60_000,
    query_timeout: 300_000,
  });

  console.log('Conectando a Supabase Postgres…');
  try {
    await client.connect();
  } catch (err) {
    console.error('❌ No se pudo conectar:', err.message);
    console.error('   ¿Proyecto pausado? Dashboard → Restore project');
    process.exit(1);
  }

  try {
    for (const file of PARTS) {
      await runPart(client, file);
    }
    await verify(client);
  } catch (err) {
    console.error('\n❌ Error en migración:', err.message);
    if (err.message?.includes('job_category') || err.message?.includes('category')) {
      const alt = join(ROOT, 'supabase', 'migrations', '010_part1b_jobs_category_only.sql');
      if (existsSync(alt)) {
        console.error('\n💡 Si falló en jobs.category, ejecuta solo: 010_part1b_jobs_category_only.sql');
      }
    }
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('\n✅ Migración 010 aplicada.');
}

main();
