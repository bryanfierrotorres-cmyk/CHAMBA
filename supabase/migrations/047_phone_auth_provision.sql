-- CHAMBA 047 — Auth.users faltante en login teléfono (mama/papa agenda vacía)
-- Crea auth.users con el mismo id que profiles cuando el técnico/cliente existe pero Auth no.

SET statement_timeout = '120s';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION ensure_phone_auth_user(
  p_profile_id UUID,
  p_phone      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_email   TEXT;
  v_phone   TEXT;
  v_password TEXT := 'ChambaTest123!';
  v_identity_id UUID;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil no encontrado');
  END IF;

  IF v_profile.phone IS NULL OR trim(v_profile.phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil sin teléfono');
  END IF;

  v_phone := regexp_replace(v_profile.phone, '\D', '', 'g');
  IF p_phone IS NOT NULL AND trim(p_phone) <> '' THEN
    IF regexp_replace(p_phone, '\D', '', 'g') <> v_phone THEN
      RETURN jsonb_build_object('success', false, 'error', 'Teléfono no coincide con el perfil');
    END IF;
  END IF;

  v_email := COALESCE(
    NULLIF(trim(v_profile.email), ''),
    v_phone || '@phone.chamba.local'
  );

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_profile_id) THEN
    RETURN jsonb_build_object(
      'success', true,
      'existing', true,
      'profile_id', p_profile_id,
      'email', v_email
    );
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change_token,
    reauthentication_token,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_profile_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', v_profile.full_name,
      'role', v_profile.role::text
    ),
    '', '', '', '', '', '', '',
    NOW(),
    NOW()
  );

  v_identity_id := gen_random_uuid();

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_identity_id,
    p_profile_id,
    jsonb_build_object('sub', p_profile_id::text, 'email', v_email),
    'email',
    v_email,
    NOW(),
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'created', true,
    'profile_id', p_profile_id,
    'email', v_email
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'existing', true, 'profile_id', p_profile_id);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION ensure_phone_auth_user(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_phone_auth_user(UUID, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION ensure_phone_auth_user IS
  'Piloto: crea auth.users con id=profiles.id si falta (login teléfono). Password: ChambaTest123!';
