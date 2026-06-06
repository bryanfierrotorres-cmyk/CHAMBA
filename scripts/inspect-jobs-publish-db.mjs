#!/usr/bin/env node
/** Inspecciona jobs (servicios): constraints, triggers, RLS, column types */
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

const tables = await c.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('jobs', 'servicios')
  ORDER BY 1
`);
console.log('\n=== Tablas public (jobs/servicios) ===');
console.table(tables.rows);

const col = await c.query(`
  SELECT column_name, udt_name, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'jobs'
  ORDER BY ordinal_position
`);
console.log('\n=== jobs.columns ===');
console.table(col.rows);

const checks = await c.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint WHERE conrelid = 'public.jobs'::regclass AND contype = 'c'
`);
console.log('\n=== jobs CHECK constraints ===');
for (const r of checks.rows) console.log('-', r.conname, ':', r.def);

const triggers = await c.query(`
  SELECT tgname, pg_get_triggerdef(t.oid) AS def
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'jobs' AND NOT t.tgisinternal
`);
console.log('\n=== jobs triggers ===');
for (const r of triggers.rows) console.log('-', r.tgname);

const rls = await c.query(`
  SELECT relrowsecurity, relforcerowsecurity
  FROM pg_class WHERE relname = 'jobs'
`);
console.log('\n=== jobs RLS enabled ===', rls.rows[0]);

const policies = await c.query(`
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies WHERE tablename = 'jobs'
`);
console.log('\n=== jobs policies ===');
for (const p of policies.rows) {
  console.log(`\n[${p.cmd}] ${p.policyname}`);
  if (p.qual) console.log('  USING:', p.qual);
  if (p.with_check) console.log('  WITH CHECK:', p.with_check);
}

const profPol = await c.query(`
  SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles'
`);
console.log('\n=== profiles policies ===');
console.table(profPol.rows);

const fn = await c.query(`
  SELECT pg_get_functiondef(oid) LIKE '%p_category::job_category%' AS still_enum_cast
  FROM pg_proc WHERE proname = 'create_client_job' LIMIT 1
`);
console.log('\n=== create_client_job still casts enum? ===', fn.rows[0]?.still_enum_cast ?? 'fn missing');

await c.end();
