-- CHAMBA 058 — Panel equipo: reconocer admin piloto por teléfono si el UUID local no coincide
SET statement_timeout = '120s';

CREATE OR REPLACE FUNCTION get_admin_team_profiles(
  p_admin_id UUID,
  p_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF p_admin_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_admin_id AND p.role::text = 'admin'
  ) INTO v_is_admin;

  -- Login piloto: mismo celular que un admin en BD aunque el id local sea distinto
  IF NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1
      FROM profiles caller
      INNER JOIN profiles adm ON adm.role::text = 'admin'
       AND regexp_replace(COALESCE(caller.phone, ''), '[^0-9]', '', 'g') <> ''
       AND regexp_replace(COALESCE(caller.phone, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(adm.phone, ''), '[^0-9]', '', 'g')
      WHERE caller.id = p_admin_id
    ) INTO v_is_admin;
  END IF;

  IF NOT v_is_admin THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC)
    FROM profiles p
    WHERE p.role::text IN ('worker', 'client')
      AND (p_role IS NULL OR p_role = '' OR p.role::text = p_role)
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_team_profiles(UUID, TEXT) TO anon, authenticated;
