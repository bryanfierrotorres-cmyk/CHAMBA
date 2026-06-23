-- ═══════════════════════════════════════════════════════════════════════════
-- CHAMBA — Piloto: Agenda del técnico (ejecutar en Supabase SQL Editor)
-- Incluye lookup de perfil por teléfono + listado de asignaciones sin JWT
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Perfil por teléfono (login técnico sin Supabase Auth)
DROP FUNCTION IF EXISTS get_profile_by_phone(TEXT);
CREATE OR REPLACE FUNCTION get_profile_by_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits TEXT;
  v_profile profiles%ROWTYPE;
BEGIN
  v_digits := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO v_profile
    FROM profiles
   WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_digits
      OR phone = v_digits
   ORDER BY created_at ASC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_profile);
END;
$$;

GRANT EXECUTE ON FUNCTION get_profile_by_phone(TEXT) TO anon, authenticated;

-- 2. Mis chambas del técnico (sin JWT)
CREATE OR REPLACE FUNCTION get_worker_assignments(p_worker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ja.id,
        'job_id', ja.job_id,
        'worker_id', ja.worker_id,
        'assigned_at', ja.assigned_at,
        'completed_at', ja.completed_at,
        'payment_status', ja.payment_status,
        'payment_intent_id', ja.payment_intent_id,
        'job', to_jsonb(j.*)
      )
      ORDER BY ja.assigned_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM job_assignments ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.worker_id = p_worker_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_worker_assignments(UUID) TO anon, authenticated;

-- 3. Columna assigned_worker_id (fallback piloto)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_worker_id UUID REFERENCES profiles(id);

UPDATE jobs j
   SET assigned_worker_id = ja.worker_id
  FROM job_assignments ja
 WHERE ja.job_id = j.id
   AND j.assigned_worker_id IS NULL;

-- 4. Lectura anónima de asignaciones (alternativa al RPC)
DROP POLICY IF EXISTS "pilot_anon_assignments_select" ON job_assignments;
CREATE POLICY "pilot_anon_assignments_select"
  ON job_assignments FOR SELECT
  TO anon
  USING (true);
