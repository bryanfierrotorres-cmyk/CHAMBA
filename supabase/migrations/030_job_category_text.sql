-- CHAMBA 030 — jobs.category como TEXT (slugs del catálogo unificado)
SET statement_timeout = '120s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'category'
      AND udt_name = 'job_category'
  ) THEN
    ALTER TABLE jobs ALTER COLUMN category DROP DEFAULT;
    ALTER TABLE jobs ALTER COLUMN category TYPE TEXT USING category::text;
  END IF;
END $$;

ALTER TABLE jobs ALTER COLUMN category SET DEFAULT 'limpieza_sofas';

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
  v_job    jobs%ROWTYPE;
  v_fee    NUMERIC;
  v_payout NUMERIC;
  v_active INT;
  v_max    INT := 2;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_created_by) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil de cliente no encontrado');
  END IF;

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

  v_fee    := ROUND(p_pay_amount * 0.05, 2);
  v_payout := ROUND(p_pay_amount * 0.95, 2);

  INSERT INTO jobs (
    title, description, category, status,
    pay_amount, platform_fee, worker_payout,
    address, lat, lng, scheduled_at,
    duration_hours, required_workers, slots_taken,
    media_urls, created_by
  ) VALUES (
    p_title, p_description, p_category, 'open',
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
