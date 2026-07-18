-- =====================================================================
-- 084_add_phone_normalized.sql
-- Sistema de login enterprise — Fase A (Opción A2: columna + trigger)
--
-- OBJETIVO: columna persistente `phone_normalized` mantenida por trigger,
--           como base sargable para un login determinístico.
-- RIESGO: BAJO. ADD COLUMN nullable = metadata-only (sin reescritura ni lock).
-- TIEMPO: < 1s. IMPACTO: ninguno en lecturas/escrituras existentes.
-- IDEMPOTENTE: sí (IF NOT EXISTS / CREATE OR REPLACE).
-- REVERSIBLE: sí (ver bloque ROLLBACK al final).
--
-- Por qué A2 (columna + trigger) y NO generated-stored:
--   permite evolucionar la lógica de normalización (ej. E.164 internacional)
--   con CREATE OR REPLACE FUNCTION + backfill por lotes, SIN reescribir la
--   tabla ni downtime. Una generated-stored exigiría DROP+ADD (lock) para
--   cambiar la expresión.
-- =====================================================================

-- 1. Columna física (nullable). Sin DEFAULT → no reescribe filas.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- 2. Única fuente de verdad de la normalización (reemplazable sin tocar la tabla).
CREATE OR REPLACE FUNCTION normalize_phone_digits(p TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g'), '');
$$;

-- 3. Trigger que mantiene phone_normalized sincronizado con phone.
CREATE OR REPLACE FUNCTION trg_profiles_set_phone_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phone_normalized := normalize_phone_digits(NEW.phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_phone_normalized ON profiles;
CREATE TRIGGER profiles_set_phone_normalized
  BEFORE INSERT OR UPDATE OF phone ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_profiles_set_phone_normalized();

-- =====================================================================
-- ROLLBACK (descomentar para revertir):
-- DROP TRIGGER IF EXISTS profiles_set_phone_normalized ON profiles;
-- DROP FUNCTION IF EXISTS trg_profiles_set_phone_normalized();
-- DROP FUNCTION IF EXISTS normalize_phone_digits(TEXT);
-- ALTER TABLE profiles DROP COLUMN IF EXISTS phone_normalized;
-- =====================================================================
