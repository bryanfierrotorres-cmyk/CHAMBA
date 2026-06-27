-- 091_avatar_url_protection.sql
-- Protección triple contra data URIs en avatar_url (producción closeout)

-- 1. Limpiar data URIs existentes (idempotente)
UPDATE profiles
SET avatar_url = NULL
WHERE avatar_url LIKE 'data:%';

-- 2. Constraint a nivel DB: imposible guardar data URI en avatar_url
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS chk_profiles_avatar_url_not_data_uri;

ALTER TABLE profiles
ADD CONSTRAINT chk_profiles_avatar_url_not_data_uri
CHECK (avatar_url IS NULL OR avatar_url NOT LIKE 'data:%');

-- 3. Actualizar RPC: strip defensivo en login payload
--    (segunda barrera si algo llegara a evadir el constraint)
CREATE OR REPLACE FUNCTION get_profile_by_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits  TEXT;
  v_profile profiles%ROWTYPE;
  v_result  JSONB;
BEGIN
  v_digits := normalize_phone_digits(p_phone);
  IF v_digits IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO v_profile
    FROM profiles
   WHERE phone_normalized = v_digits
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_result := to_jsonb(v_profile);

  -- Strip data URIs del payload de login para prevenir timeouts
  IF (v_result ->> 'avatar_url') LIKE 'data:%' THEN
    v_result := jsonb_set(v_result, '{avatar_url}', 'null'::jsonb);
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_profile_by_phone(TEXT) TO anon, authenticated;

-- Verificación final
SELECT
  (SELECT COUNT(*) FROM profiles WHERE avatar_url LIKE 'data:%') AS data_uris_restantes,
  (SELECT get_profile_by_phone('88884444') ->> 'full_name')      AS tecnico_login,
  (SELECT get_profile_by_phone('88883333') ->> 'full_name')      AS cliente_login;
-- Esperado: 0 | "Técnico de Prueba" | "Cliente de Prueba"
