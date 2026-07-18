-- =====================================================================
-- 089_replace_get_profile_by_phone.sql
-- Fase F — RPC enterprise sargable.
--
-- OBJETIVO: login determinístico con Index Scan sobre phone_normalized.
-- RIESGO: BAJO. Firma pública IDÉNTICA → el frontend no cambia.
-- TIEMPO: instantáneo (CREATE OR REPLACE). IMPACTO: cero downtime.
-- IDEMPOTENTE: sí. REVERSIBLE: sí (restaurar cuerpo de 009).
--
-- Elimina vs versión 009:
--   ✗ regexp_replace(phone) sobre la columna  → ✓ phone_normalized = v_digits
--   ✗ OR phone = v_digits                     → (innecesario, datos normalizados)
--   ✗ ORDER BY created_at ASC                 → (innecesario, UNIQUE garantiza 1 fila)
-- =====================================================================

CREATE OR REPLACE FUNCTION get_profile_by_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits  TEXT;
  v_profile profiles%ROWTYPE;
BEGIN
  v_digits := normalize_phone_digits(p_phone);
  IF v_digits IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO v_profile
    FROM profiles
   WHERE phone_normalized = v_digits   -- ✅ sargable → Index Scan idx_profiles_phone_normalized
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_profile);
END;
$$;

GRANT EXECUTE ON FUNCTION get_profile_by_phone(TEXT) TO anon, authenticated;

-- =====================================================================
-- ROLLBACK: restaurar la versión de 009_pilot_worker_agenda.sql
-- (CREATE OR REPLACE con el WHERE regexp_replace(...) OR phone = v_digits).
-- =====================================================================
