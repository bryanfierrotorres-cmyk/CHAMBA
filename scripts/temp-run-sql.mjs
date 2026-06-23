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

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Define SUPABASE_DB_URL en .env');
  process.exit(1);
}

const db = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function main() {
  await db.connect();
  console.log('Connected to DB. Running SQL...');

  const sql = `
DROP FUNCTION IF EXISTS count_worker_active_commitments(UUID);
DROP FUNCTION IF EXISTS count_worker_active_commitments(UUID, UUID);

CREATE OR REPLACE FUNCTION count_worker_active_commitments(
  p_worker_id UUID,
  p_exclude_job_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT j.id)::INT
  FROM job_assignments ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.worker_id = p_worker_id
    AND j.status::text NOT IN ('completed', 'cancelled')
    AND (p_exclude_job_id IS NULL OR j.id IS DISTINCT FROM p_exclude_job_id)
    AND (
      (j.status::text = 'open' AND ja.selection_status = 'pending')
      OR (j.status::text IN ('taken', 'in_progress') AND ja.selection_status = 'approved')
    );
$$;
GRANT EXECUTE ON FUNCTION count_worker_active_commitments(UUID, UUID) TO anon, authenticated;

DROP FUNCTION IF EXISTS client_approve_worker_application(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION client_approve_worker_application(
  p_job_id    UUID,
  p_client_id UUID,
  p_worker_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_client profiles%ROWTYPE;
  v_assignment_id UUID;
  v_active INT;
  v_max_active INT := 2;
  v_owns BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_job.created_by = p_client_id THEN
    v_owns := TRUE;
  ELSE
    SELECT * INTO v_client FROM profiles WHERE id = p_client_id;
    IF FOUND AND v_client.phone IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM profiles owner
        WHERE owner.id = v_job.created_by
          AND owner.phone IS NOT NULL
          AND regexp_replace(owner.phone, '\\D', '', 'g')
            = regexp_replace(v_client.phone, '\\D', '', 'g')
      ) INTO v_owns;
    END IF;
  END IF;

  IF NOT v_owns THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_job.status::text <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya fue asignada');
  END IF;

  SELECT id INTO v_assignment_id
  FROM job_assignments
  WHERE job_id = p_job_id
    AND worker_id = p_worker_id
    AND selection_status = 'pending';

  IF v_assignment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este técnico no tiene una postulación activa');
  END IF;

  v_active := count_worker_active_commitments(p_worker_id, p_job_id);
  IF v_active >= v_max_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este técnico ya tiene 2 chambas activas y no puede tomar otra hasta finalizar una.',
      'code', 'worker_active_limit'
    );
  END IF;

  UPDATE job_assignments
  SET selection_status = 'approved'
  WHERE id = v_assignment_id;

  UPDATE job_assignments
  SET selection_status = 'rejected'
  WHERE job_id = p_job_id
    AND selection_status = 'pending'
    AND worker_id <> p_worker_id;

  UPDATE jobs
  SET status = 'taken',
      assigned_worker_id = p_worker_id,
      slots_taken = 1,
      operational_phase = 'accepted',
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'worker_id', p_worker_id,
    'job_status', 'taken',
    'selection_status', 'approved',
    'operational_phase', 'accepted'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION client_approve_worker_application(UUID, UUID, UUID) TO anon, authenticated;
  `;

  await db.query(sql);
  console.log('✅ SQL executed successfully!');
  await db.end();
}

main().catch(console.error);
