-- ═══════════════════════════════════════════════════════════════════════════
-- CHAMBA — Migración completa (ejecutar UNA vez en Supabase SQL Editor)
-- Sincroniza enums, perfiles, RLS y RPC con la app móvil.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Rol cliente ────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE 'client';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Las 8 categorías oficiales en job_category ───────────────────────────
DO $$ BEGIN ALTER TYPE job_category ADD VALUE 'limpieza_sofas';          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE job_category ADD VALUE 'limpieza_alfombra';       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE job_category ADD VALUE 'alfombra_institucional';  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE job_category ADD VALUE 'fumigacion';              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE job_category ADD VALUE 'vehiculo_profundo';       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE job_category ADD VALUE 'conserjeria_ocasional';   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE job_category ADD VALUE 'conserjeria_contrato';    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- jardineria suele existir en esquemas legacy

-- ── 3. Columnas de perfil (documentos + especialidades) ───────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS worker_status       TEXT,
  ADD COLUMN IF NOT EXISTS cedula_url          TEXT,
  ADD COLUMN IF NOT EXISTS record_policia_url  TEXT,
  ADD COLUMN IF NOT EXISTS category_1          TEXT,
  ADD COLUMN IF NOT EXISTS category_2          TEXT,
  ADD COLUMN IF NOT EXISTS category_1_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS category_2_approved BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. RLS: cliente publica y ve sus solicitudes ──────────────────────────
DROP POLICY IF EXISTS "jobs: client insert own" ON jobs;
CREATE POLICY "jobs: client insert own"
  ON jobs FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role::text IN ('client', 'admin')
    )
  );

DROP POLICY IF EXISTS "jobs: client select own" ON jobs;
CREATE POLICY "jobs: client select own"
  ON jobs FOR SELECT
  USING (created_by = auth.uid());

-- Colaborador actualiza estado del trabajo que tomó
DROP POLICY IF EXISTS "jobs: worker update assigned" ON jobs;
CREATE POLICY "jobs: worker update assigned"
  ON jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      WHERE ja.job_id = jobs.id AND ja.worker_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "assignments: worker insert own" ON job_assignments;
CREATE POLICY "assignments: worker insert own"
  ON job_assignments FOR INSERT
  WITH CHECK (worker_id = auth.uid());

-- ── 5. RPC: crear solicitud (cliente piloto sin sesión JWT) ───────────────
CREATE OR REPLACE FUNCTION create_client_job(
  p_created_by       UUID,
  p_title            TEXT,
  p_description      TEXT,
  p_category         TEXT,
  p_pay_amount       NUMERIC,
  p_address          TEXT,
  p_lat              DOUBLE PRECISION,
  p_lng              DOUBLE PRECISION,
  p_duration_hours   NUMERIC DEFAULT 2,
  p_required_workers INTEGER DEFAULT 1,
  p_scheduled_at     TIMESTAMPTZ DEFAULT NULL,
  p_media_urls       TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job   jobs%ROWTYPE;
  v_fee   NUMERIC;
  v_payout NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_created_by) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil de cliente no encontrado');
  END IF;

  v_fee    := ROUND(p_pay_amount * 0.05, 2);
  v_payout := ROUND(p_pay_amount * 0.95, 2);

  INSERT INTO jobs (
    title, description, category, status,
    pay_amount, platform_fee, worker_payout,
    address, lat, lng, scheduled_at,
    duration_hours, required_workers, slots_taken,
    media_urls, created_by
  ) VALUES (
    p_title, p_description, p_category::job_category, 'open',
    p_pay_amount, v_fee, v_payout,
    p_address, p_lat, p_lng, p_scheduled_at,
    p_duration_hours, p_required_workers, 0,
    COALESCE(p_media_urls, '{}'), p_created_by
  )
  RETURNING * INTO v_job;

  RETURN jsonb_build_object('success', true, 'job', to_jsonb(v_job));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION create_client_job TO anon, authenticated;

-- ── 6. RPC: listar solicitudes del cliente (piloto / sin JWT) ───────────────
CREATE OR REPLACE FUNCTION get_client_jobs(p_client_id UUID)
RETURNS SETOF jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM jobs WHERE created_by = p_client_id ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_client_jobs(UUID) TO anon, authenticated;

-- ── 7. RPC trabajador: en proceso / finalizado ────────────────────────────
CREATE OR REPLACE FUNCTION worker_start_job(p_job_id UUID, p_worker_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_assignments WHERE job_id = p_job_id AND worker_id = p_worker_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin asignación');
  END IF;
  UPDATE jobs SET status = 'in_progress', updated_at = NOW()
   WHERE id = p_job_id AND status IN ('open', 'taken');
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION worker_complete_job(
  p_job_id UUID, p_worker_id UUID, p_assignment_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM job_assignments
     WHERE id = p_assignment_id AND job_id = p_job_id AND worker_id = p_worker_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asignación inválida');
  END IF;
  UPDATE jobs SET status = 'completed', updated_at = v_now WHERE id = p_job_id;
  UPDATE job_assignments SET completed_at = v_now WHERE id = p_assignment_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION worker_start_job(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION worker_complete_job(UUID, UUID, UUID) TO anon, authenticated;
