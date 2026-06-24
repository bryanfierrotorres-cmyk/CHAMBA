-- CHAMBA 067 — Cancelación Explícita y Reglas de Mercado (Re-broadcast)
SET statement_timeout = '120s';

-- 1. Añadir estado de cancelación y broadcast_version
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'job_status' AND e.enumlabel = 'cancelled_by_client_pending') THEN
    ALTER TYPE job_status ADD VALUE 'cancelled_by_client_pending';
  END IF;
END $$;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS broadcast_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN jobs.broadcast_version IS 'Incrementa en re-broadcasts de precio (para reaparición en radares).';
COMMENT ON COLUMN jobs.cancelled_at IS 'Momento en que el cliente canceló.';

-- 2. Actualizar boost_client_job_offer para incluir regla +C$20 y broadcast_version
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

  -- Regla financiera: Incremento mínimo de C$20
  IF p_pay_amount < (COALESCE(v_job.pay_amount, 0) + 20) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El incremento debe ser de al menos C$20 para destacar la oferta en el radar.');
  END IF;

  v_fee := ROUND(p_pay_amount * 0.05, 2);
  v_payout := ROUND(p_pay_amount * 0.95, 2);

  UPDATE jobs
  SET pay_amount = p_pay_amount,
      platform_fee = v_fee,
      worker_payout = v_payout,
      broadcast_version = COALESCE(broadcast_version, 1) + 1,
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

GRANT EXECUTE ON FUNCTION boost_client_job_offer(UUID, UUID, NUMERIC) TO authenticated, anon;


-- 3. Crear RPC cancel_client_job
CREATE OR REPLACE FUNCTION cancel_client_job(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = on
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión requerida', 'code', 'auth_required');
  END IF;

  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_job.created_by IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado: No sos el creador de la solicitud.');
  END IF;

  IF v_job.status::text IN ('taken', 'in_progress', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No podés cancelar una solicitud que ya está en curso o completada directamente. Contactá a soporte.');
  END IF;

  IF v_job.status::text IN ('cancelled', 'cancelled_by_client_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud ya estaba cancelada.');
  END IF;

  -- Transición a cancelled_by_client_pending (estaba en open, pending_bidding, o counter_offered)
  UPDATE jobs
  SET status = 'cancelled_by_client_pending',
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN jsonb_build_object('success', true, 'job', to_jsonb(v_job));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_client_job(UUID) TO authenticated, anon;
