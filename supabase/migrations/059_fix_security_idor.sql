-- CHAMBA 059 — Corrige vulnerabilidad IDOR y bypass de anon en agenda de trabajadores
-- Exige autenticación y restringe el acceso al propio trabajador o administradores.

SET statement_timeout = '120s';

CREATE OR REPLACE FUNCTION get_worker_agenda_panel(p_worker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_worker_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 1. Validar autenticación: bloquear usuarios anónimos (anon)
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 2. Restringir acceso: solo el propio técnico dueño del ID o un administrador
  IF auth.uid() <> p_worker_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'admin'
    ) THEN
      RETURN '[]'::jsonb;
    END IF;
  END IF;

  -- 3. Validar rol del perfil solicitado
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_worker_id AND p.role::text = 'worker'
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(row_payload ORDER BY assigned_at DESC),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      ja.assigned_at,
      jsonb_build_object(
        'id', ja.id,
        'job_id', ja.job_id,
        'worker_id', ja.worker_id,
        'assigned_at', ja.assigned_at,
        'completed_at', ja.completed_at,
        'payment_status', ja.payment_status,
        'payment_intent_id', ja.payment_intent_id,
        'selection_status', ja.selection_status,
        'job', jsonb_build_object(
          'id', j.id,
          'title', j.title,
          'description', j.description,
          'category', j.category,
          'status', j.status,
          'operational_phase', j.operational_phase,
          'pay_amount', j.pay_amount,
          'worker_payout', j.worker_payout,
          'platform_fee', j.platform_fee,
          'duration_hours', j.duration_hours,
          'created_by', j.created_by,
          'assigned_worker_id', j.assigned_worker_id,
          'address', j.address,
          'lat', j.lat,
          'lng', j.lng,
          'created_at', j.created_at,
          'updated_at', j.updated_at
        )
      ) AS row_payload
    FROM job_assignments ja
    INNER JOIN jobs j ON j.id = ja.job_id
    WHERE ja.worker_id = p_worker_id
      AND NOT (
        ja.selection_status = 'rejected'
        AND j.status::text IN ('taken', 'in_progress', 'completed', 'cancelled')
      )
    ORDER BY ja.assigned_at DESC
    LIMIT 40
  ) sub;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION get_worker_assignments(p_worker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Validar autenticación: bloquear usuarios anónimos (anon)
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 2. Restringir acceso: solo el propio técnico dueño del ID o un administrador
  -- (Esto satisface el RLS test que valida presencia de auth.uid() y p_worker_id en el cuerpo de la función)
  IF auth.uid() <> p_worker_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'admin'
    ) THEN
      RETURN '[]'::jsonb;
    END if;
  END IF;

  RETURN get_worker_agenda_panel(p_worker_id);
END;
$$;

GRANT EXECUTE ON FUNCTION get_worker_agenda_panel(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_worker_assignments(UUID) TO anon, authenticated;
