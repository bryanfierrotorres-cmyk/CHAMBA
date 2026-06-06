#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = '030_jobs_scheduling.sql';

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

const ORPHAN_QUERY = `
  SELECT id, status, scheduled_at, scheduled_date, urgency_level
  FROM jobs
  WHERE urgency_level = 'programado'
    AND scheduled_date IS NULL
`;

async function main() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: colRows } = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name IN ('scheduled_date', 'scheduled_time', 'urgency_level')
  `);

  if (colRows.length === 3) {
    console.log('ℹ️  Columnas de programación ya existen — verificando integridad…');
    const { rows: orphans } = await client.query(ORPHAN_QUERY);
    if (orphans.length > 0) {
      console.error('❌ Jobs programados sin fecha:', orphans.length);
      console.error(orphans);
      await client.end();
      process.exit(1);
    }
    console.log('✅ Sin huérfanos programado/sin-fecha');
    await client.end();
    return;
  }

  const { rows: preCount } = await client.query(`SELECT COUNT(*)::int AS total FROM jobs`);
  console.log(`Jobs existentes antes de migrar: ${preCount[0]?.total ?? 0}`);

  await client.query(readFileSync(join(ROOT, 'supabase', 'migrations', MIGRATION), 'utf8'));

  const { rows: orphans } = await client.query(ORPHAN_QUERY);
  if (orphans.length > 0) {
    console.error('❌ Verificación fallida — programados sin fecha:', orphans.length);
    console.error(orphans);
    await client.end();
    process.exit(1);
  }

  const { rows: cols } = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name IN ('scheduled_date', 'scheduled_time', 'urgency_level')
    ORDER BY column_name
  `);

  const { rows: urgencyDist } = await client.query(`
    SELECT urgency_level, COUNT(*)::int AS total
    FROM jobs
    GROUP BY urgency_level
    ORDER BY urgency_level
  `);

  const { rows: fnRows } = await client.query(`
    SELECT pg_get_function_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_client_job'
  `);

  await client.end();

  console.log('✅ Migration 030 (jobs scheduling) applied');
  console.log('Columnas:', cols.map((c) => `${c.column_name} (${c.data_type})`).join(', '));
  console.log('Distribución urgency_level:', urgencyDist.map((r) => `${r.urgency_level}=${r.total}`).join(', '));
  console.log('create_client_job args:', fnRows[0]?.args ?? '(no encontrada)');
  console.log('✅ Verificación: 0 jobs programados huérfanos sin fecha');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
