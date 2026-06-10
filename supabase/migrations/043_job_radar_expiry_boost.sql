-- CHAMBA 043 — Radar: solo jobs open de los últimos 60 min + impulso de presupuesto (cliente)
SET statement_timeout = '120s';

-- ── Feed técnico: excluir solicitudes vencidas en servidor ─────────────────
CREATE OR REPLACE FUNCTION get_worker_open_jobs_feed(
  p_worker_id    UUID,
  p_status       TEXT DEFAULT 'open',
  p_categories   TEXT[] DEFAULT NULL,
  p_limit        INT DEFAULT 20,
  p_offset       INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total BIGINT;
  v_status TEXT;
  v_min_created TIMESTAMPTZ := NOW() - INTERVAL '60 minutes';
BEGIN
  IF p_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajador requerido');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_worker_id
      AND p.role::text = 'worker'
      AND COALESCE(p.is_approved, FALSE) = TRUE
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Colaborador no aprobado');
  END IF;

  v_status := COALESCE(NULLIF(trim(p_status), ''), 'open');

  IF v_status <> 'open' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solo feed de trabajos abiertos (open)'
    );
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM jobs j
  WHERE j.status::text = 'open'
    AND j.created_at >= v_min_created
    AND (
      p_categories IS NULL
      OR cardinality(p_categories) = 0
      OR j.category::text = ANY (p_categories)
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT j.*
    FROM jobs j
    WHERE j.status::text = 'open'
      AND j.created_at >= v_min_created
      AND (
        p_categories IS NULL
        OR cardinality(p_categories) = 0
        OR j.category::text = ANY (p_categories)
      )
    ORDER BY j.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0)
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'jobs', v_rows,
    'count', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_open_jobs_feed(
  p_status       TEXT DEFAULT 'open',
  p_categories   TEXT[] DEFAULT NULL,
  p_limit        INT DEFAULT 20,
  p_offset       INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total BIGINT;
  v_status TEXT;
  v_min_created TIMESTAMPTZ := NOW() - INTERVAL '60 minutes';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión requerida');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (
        (p.role::text = 'worker' AND COALESCE(p.is_approved, FALSE) = TRUE)
        OR p.role::text = 'admin'
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Colaborador no aprobado');
  END IF;

  v_status := COALESCE(NULLIF(trim(p_status), ''), 'open');
  IF v_status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo feed de trabajos abiertos (open)');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM jobs j
  WHERE j.status::text = 'open'
    AND j.created_at >= v_min_created
    AND (
      p_categories IS NULL
      OR cardinality(p_categories) = 0
      OR j.category::text = ANY (p_categories)
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT j.*
    FROM jobs j
    WHERE j.status::text = 'open'
      AND j.created_at >= v_min_created
      AND (
        p_categories IS NULL
        OR cardinality(p_categories) = 0
        OR j.category::text = ANY (p_categories)
      )
    ORDER BY j.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0)
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'jobs', v_rows,
    'count', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_worker_open_jobs_feed(UUID, TEXT, TEXT[], INT, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_open_jobs_feed(TEXT, TEXT[], INT, INT) TO authenticated;

-- ── Impulsar solicitud: nuevo presupuesto + reinicio de created_at ─────────
CREATE OR REPLACE FUNCTION boost_client_job_offer(
  p_job_id     UUID,
  p_client_id  UUID,
  p_pay_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = on
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_fee NUMERIC;
  v_payout NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión requerida', 'code', 'auth_required');
  END IF;

  IF auth.uid() IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_pay_amount IS NULL OR p_pay_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El monto debe ser mayor a cero');
  END IF;

  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_job.created_by IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF v_job.status::text <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo podés impulsar solicitudes abiertas');
  END IF;

  IF v_job.assigned_worker_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya hay un técnico asignado');
  END IF;

  v_fee := ROUND(p_pay_amount * 0.05, 2);
  v_payout := ROUND(p_pay_amount * 0.95, 2);

  UPDATE jobs
  SET pay_amount = p_pay_amount,
      platform_fee = v_fee,
      worker_payout = v_payout,
      created_at = NOW(),
      updated_at = NOW()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN jsonb_build_object('success', true, 'job', to_jsonb(v_job));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION boost_client_job_offer(UUID, UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION boost_client_job_offer(UUID, UUID, NUMERIC) TO authenticated;
