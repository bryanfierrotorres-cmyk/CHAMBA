-- =====================================================================
-- APLICAR_LOGIN_FIX.sql  —  Solución definitiva del login por teléfono
-- Ejecutar COMPLETO en: Supabase → SQL Editor → Run
-- (tabla pequeña → índices normales, instantáneos; sin CONCURRENTLY)
-- =====================================================================

-- 1) ELIMINAR DUPLICADO 88883333 (conservar "Cliente de Prueba", preservar la reseña)
UPDATE worker_reviews SET reviewer_id = 'b0332110-9d62-46f4-89d2-d4139d9a98e3'
 WHERE reviewer_id = 'd53db136-71cb-441d-bd11-772abf8e90bc';
UPDATE jobs SET created_by = 'b0332110-9d62-46f4-89d2-d4139d9a98e3'
 WHERE created_by = 'd53db136-71cb-441d-bd11-772abf8e90bc';
DELETE FROM profiles WHERE id = 'd53db136-71cb-441d-bd11-772abf8e90bc';

-- 2) COLUMNA NORMALIZADA + FUNCIÓN + TRIGGER
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

CREATE OR REPLACE FUNCTION normalize_phone_digits(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p,''),'[^0-9]','','g'),'');
$$;

CREATE OR REPLACE FUNCTION trg_profiles_set_phone_normalized()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.phone_normalized := normalize_phone_digits(NEW.phone); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS profiles_set_phone_normalized ON profiles;
CREATE TRIGGER profiles_set_phone_normalized
  BEFORE INSERT OR UPDATE OF phone ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_profiles_set_phone_normalized();

-- 3) BACKFILL (idempotente)
UPDATE profiles SET phone_normalized = normalize_phone_digits(phone)
 WHERE phone IS NOT NULL
   AND phone_normalized IS DISTINCT FROM normalize_phone_digits(phone);

-- 4) ÍNDICES (incluye UNIQUE: ya no habrá duplicados)
CREATE INDEX IF NOT EXISTS idx_profiles_phone_normalized
  ON profiles (phone_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_normalized_uniq
  ON profiles (phone_normalized) WHERE phone_normalized IS NOT NULL;

-- 5) RPC SARGABLE (reemplaza el viejo con regexp; misma firma → frontend no cambia)
CREATE OR REPLACE FUNCTION get_profile_by_phone(p_phone TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_digits TEXT; v_profile profiles%ROWTYPE;
BEGIN
  v_digits := normalize_phone_digits(p_phone);
  IF v_digits IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_profile FROM profiles WHERE phone_normalized = v_digits LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(v_profile);
END;
$$;
GRANT EXECUTE ON FUNCTION get_profile_by_phone(TEXT) TO anon, authenticated;

-- 6) VERIFICACIÓN (debe devolver los dos nombres, sin timeout)
SELECT get_profile_by_phone('88883333')->>'full_name' AS cliente,
       get_profile_by_phone('88884444')->>'full_name' AS tecnico;
-- Esperado:  cliente = "Cliente de Prueba"  |  tecnico = "Técnico de Prueba"
