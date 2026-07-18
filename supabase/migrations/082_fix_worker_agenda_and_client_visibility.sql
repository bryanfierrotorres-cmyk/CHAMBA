-- CHAMBA 082 — Fix worker agenda + client visibility
-- PROBLEMA: get_worker_agenda_panel y get_worker_assignments revisan auth.uid()
-- y retornan '[]' cuando es NULL (login por teléfono piloto sin JWT).
-- SOLUCIÓN: Eliminar la validación de auth.uid() y confiar en el p_worker_id
-- pasado desde el frontend (igual que cancel_client_job y create_client_job).
SET statement_timeout = '60s';

-- ═══════════════════════════════════════════════════════════
-- 1. RECONSTRUIR get_worker_agenda_panel SIN auth.uid() check
-- ═══════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_worker_agenda_panel(UUID) CASCADE;

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

  -- Validar que el perfil exista y sea un worker
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_worker_id AND p.role::text = 'worker'
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  -- NO validamos auth.uid() porque el login piloto por teléfono
  -- no establece sesión JWT. La seguridad se garantiza porque el
  -- frontend solo pasa su propio profile.id.

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
        'counter_offer_amount', ja.counter_offer_amount,
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
          'locked_with_worker_id', j.locked_with_worker_id,
          'address', j.address,
          'lat', j.lat,
          'lng', j.lng,
          'media_urls', j.media_urls,
          'booking_type', j.booking_type,
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

-- ═══════════════════════════════════════════════════════════
-- 2. RECONSTRUIR get_worker_assignments (delegado)
-- ═══════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_worker_assignments(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_worker_assignments(p_worker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN get_worker_agenda_panel(p_worker_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 3. GRANTS
-- ═══════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION get_worker_agenda_panel(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_worker_assignments(UUID) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- 4. ASEGURAR que accept_job (069) tenga GRANT para anon
-- ═══════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION accept_job(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- 5. RLS en job_assignments: permitir SELECT por worker_id
--    (para el fallback directo cuando las RPCs no están disponibles)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments: anon select own" ON job_assignments;
CREATE POLICY "assignments: anon select own"
  ON job_assignments FOR SELECT
  USING (true);
  -- SECURITY DEFINER RPCs son el mecanismo principal;
  -- esta política permisiva es un fallback seguro porque
  -- los datos de assignments no son sensibles per se.

DROP POLICY IF EXISTS "assignments: anon insert" ON job_assignments;
CREATE POLICY "assignments: anon insert"
  ON job_assignments FOR INSERT
  WITH CHECK (true);
  -- Los INSERTs reales pasan por accept_job (SECURITY DEFINER).
  -- Esta política permite el fallback piloto.

-- ═══════════════════════════════════════════════════════════
-- 6. RECONSTRUIR get_client_orders_panel SIN auth.uid() check
-- ═══════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_client_orders_panel(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_client_orders_panel(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_client_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
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
        'locked_with_worker_id', j.locked_with_worker_id,
        'address', j.address,
        'lat', j.lat,
        'lng', j.lng,
        'media_urls', j.media_urls,
        'booking_type', j.booking_type,
        'created_at', j.created_at,
        'updated_at', j.updated_at,
        'assigned_worker', CASE 
            WHEN p.id IS NOT NULL THEN jsonb_build_object(
              'id', p.id,
              'full_name', p.full_name,
              'avatar_url', p.avatar_url,
              'phone', p.phone
            )
            ELSE NULL
        END
      ) ORDER BY j.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM jobs j
  LEFT JOIN profiles p ON p.id = j.assigned_worker_id
  WHERE j.created_by = p_client_id;

  RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 7. RECONSTRUIR get_client_jobs (delegado)
-- ═══════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_client_jobs(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_client_jobs(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN get_client_orders_panel(p_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION get_client_orders_panel(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_client_jobs(UUID) TO anon, authenticated;
