-- CHAMBA 030 — Programación de servicios (fecha, hora, urgencia)
-- Alcance: SOLO columnas nuevas en `jobs` + RPC create_client_job actualizado.
SET statement_timeout = '120s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NUEVAS COLUMNAS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_date  DATE,
  ADD COLUMN IF NOT EXISTS scheduled_time  TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS urgency_level   TEXT;

COMMENT ON COLUMN jobs.scheduled_date IS
  'Fecha calendario del servicio (día acordado con el cliente).';

COMMENT ON COLUMN jobs.scheduled_time IS
  'Hora aproximada del servicio en zona local (Nicaragua).';

COMMENT ON COLUMN jobs.urgency_level IS
  'Nivel de urgencia visible para técnicos: hoy | manana | programado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BACKFILL — registros existentes
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE jobs
SET urgency_level = 'hoy'
WHERE urgency_level IS NULL;

UPDATE jobs
SET
  scheduled_date = COALESCE(
    scheduled_date,
    (scheduled_at AT TIME ZONE 'America/Managua')::date
  ),
  scheduled_time = COALESCE(
    scheduled_time,
    (scheduled_at AT TIME ZONE 'America/Managua')::time
  )
WHERE scheduled_at IS NOT NULL
  AND (scheduled_date IS NULL OR scheduled_time IS NULL);

UPDATE jobs
SET urgency_level = 'programado'
WHERE scheduled_date IS NOT NULL
  AND scheduled_date > CURRENT_DATE
  AND urgency_level = 'hoy';

UPDATE jobs
SET urgency_level = 'manana'
WHERE scheduled_date IS NOT NULL
  AND scheduled_date = CURRENT_DATE + INTERVAL '1 day'
  AND urgency_level = 'hoy';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DEFAULTS Y RESTRICCIONES
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE jobs
  ALTER COLUMN urgency_level SET DEFAULT 'hoy';

DO $$
BEGIN
  ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_urgency_level_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_urgency_level_check
  CHECK (urgency_level IN ('hoy', 'manana', 'programado'));

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_scheduling_programado_requires_date;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_scheduling_programado_requires_date
  CHECK (
    urgency_level <> 'programado'
    OR scheduled_date IS NOT NULL
  );

ALTER TABLE jobs
  ALTER COLUMN urgency_level SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_jobs_open_urgency_date
  ON jobs (urgency_level, scheduled_date NULLS LAST, created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date
  ON jobs (scheduled_date)
  WHERE scheduled_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC create_client_job — defaults de programación ('hoy', hora opcional)
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS create_client_job(
  UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION,
  NUMERIC, INTEGER, TIMESTAMPTZ, TEXT[]
);

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
  p_media_urls       TEXT[] DEFAULT '{}',
  p_scheduled_date   DATE DEFAULT NULL,
  p_scheduled_time   TIME DEFAULT NULL,
  p_urgency_level    TEXT DEFAULT 'hoy'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job            jobs%ROWTYPE;
  v_fee            NUMERIC;
  v_payout         NUMERIC;
  v_active         INT;
  v_max            INT := 2;
  v_role           TEXT;
  v_urgency        TEXT;
  v_scheduled_date DATE;
  v_scheduled_time TIME;
BEGIN
  SELECT role::text INTO v_role FROM profiles WHERE id = p_created_by;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil no encontrado');
  END IF;

  IF v_role <> 'admin' THEN
    v_active := count_client_active_jobs(p_created_by);
    IF v_active >= v_max THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Ya tenés 2 solicitudes activas. Cuando una figure como finalizada, podés publicar otra.',
        'code', 'client_active_limit',
        'active_count', v_active,
        'max_allowed', v_max
      );
    END IF;
  END IF;

  v_urgency := lower(trim(COALESCE(p_urgency_level, 'hoy')));
  IF v_urgency NOT IN ('hoy', 'manana', 'programado') THEN
    v_urgency := 'hoy';
  END IF;

  v_scheduled_date := p_scheduled_date;
  v_scheduled_time := p_scheduled_time;

  IF v_scheduled_date IS NULL AND p_scheduled_at IS NOT NULL THEN
    v_scheduled_date := (p_scheduled_at AT TIME ZONE 'America/Managua')::date;
    v_scheduled_time := COALESCE(
      v_scheduled_time,
      (p_scheduled_at AT TIME ZONE 'America/Managua')::time
    );
  END IF;

  IF v_urgency = 'hoy' AND v_scheduled_date IS NOT NULL THEN
    IF v_scheduled_date > CURRENT_DATE THEN
      v_urgency := 'programado';
    ELSIF v_scheduled_date = CURRENT_DATE + INTERVAL '1 day' THEN
      v_urgency := 'manana';
    END IF;
  ELSIF v_urgency = 'manana' AND v_scheduled_date IS NULL THEN
    v_scheduled_date := CURRENT_DATE + INTERVAL '1 day';
  ELSIF v_urgency = 'programado' AND v_scheduled_date IS NULL THEN
    v_urgency := 'hoy';
  END IF;

  v_fee    := ROUND(p_pay_amount * 0.05, 2);
  v_payout := ROUND(p_pay_amount * 0.95, 2);

  INSERT INTO jobs (
    title, description, category, status,
    pay_amount, platform_fee, worker_payout,
    address, lat, lng, scheduled_at,
    scheduled_date, scheduled_time, urgency_level,
    duration_hours, required_workers, slots_taken,
    media_urls, created_by, operational_phase
  ) VALUES (
    p_title, p_description, p_category, 'open',
    p_pay_amount, v_fee, v_payout,
    p_address, p_lat, p_lng, p_scheduled_at,
    v_scheduled_date, v_scheduled_time, v_urgency,
    p_duration_hours, p_required_workers, 0,
    COALESCE(p_media_urls, '{}'), p_created_by, 'pending'
  )
  RETURNING * INTO v_job;

  RETURN jsonb_build_object('success', true, 'job', to_jsonb(v_job));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION create_client_job TO anon, authenticated;
