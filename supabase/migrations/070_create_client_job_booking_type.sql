-- CHAMBA 070 — Agregar booking_type a create_client_job
SET statement_timeout = '60s';

DROP FUNCTION IF EXISTS create_client_job(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC, INTEGER, TIMESTAMPTZ, TEXT[]);

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
  p_booking_type     TEXT DEFAULT 'custom'
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
    title, description, category, status, booking_type,
    pay_amount, platform_fee, worker_payout,
    address, lat, lng, scheduled_at,
    duration_hours, required_workers, slots_taken,
    media_urls, created_by
  ) VALUES (
    p_title, p_description, lower(trim(p_category)), 'open', p_booking_type,
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
