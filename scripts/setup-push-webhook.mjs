#!/usr/bin/env node
/**
 * Crea trigger pg_net → notify-new-job en INSERT jobs.
 * Requiere SUPABASE_DB_URL en .env
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = 'twsrthtyaglpymdfdtdp';
const FUNCTION_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/notify-new-job`;

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

const SQL = `
-- Extensión pg_net (webhooks Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.chamba_notify_new_job_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := '${FUNCTION_URL}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'jobs',
      'schema', 'public',
      'record', jsonb_build_object(
        'id', NEW.id,
        'title', NEW.title,
        'category', NEW.category,
        'status', NEW.status,
        'pay_amount', NEW.pay_amount,
        'worker_payout', NEW.worker_payout
      )
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'chamba_notify_new_job_webhook: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_insert_notify_workers ON public.jobs;

CREATE TRIGGER jobs_insert_notify_workers
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.chamba_notify_new_job_webhook();
`;

async function main() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const ext = await client.query(
    "SELECT 1 FROM pg_extension WHERE extname = 'pg_net'",
  );
  if (ext.rowCount === 0) {
    console.warn('⚠️  pg_net no encontrada; intentando CREATE EXTENSION…');
  }

  await client.query(SQL);

  const { rows } = await client.query(`
    SELECT tgname FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'jobs' AND tgname = 'jobs_insert_notify_workers'
  `);

  await client.end();

  if (rows.length === 0) {
    console.error('❌ Trigger no creado');
    process.exit(1);
  }

  console.log('✅ Webhook SQL activo: jobs INSERT → notify-new-job');
  console.log(`   URL: ${FUNCTION_URL}`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
