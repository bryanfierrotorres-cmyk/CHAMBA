-- ================================================================
-- CHAMBA — Crear usuarios de prueba
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- PASO 1: Crear los 3 usuarios en el sistema de autenticación
-- (Con contraseñas encriptadas correctamente por Supabase)

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  confirmation_token,
  recovery_token
)
VALUES
  -- 👑 ADMIN
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@chamba.com',
    crypt('Admin1234!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin CHAMBA"}',
    'authenticated',
    'authenticated',
    '',
    ''
  ),
  -- 🔧 TÉCNICO
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'tecnico@chamba.com',
    crypt('Tecnico1234!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Juan Técnico"}',
    'authenticated',
    'authenticated',
    '',
    ''
  ),
  -- 👤 CLIENTE
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'cliente@chamba.com',
    crypt('Cliente1234!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"María Cliente"}',
    'authenticated',
    'authenticated',
    '',
    ''
  )
ON CONFLICT (email) DO NOTHING;

-- ================================================================
-- PASO 2: Crear los perfiles en la tabla profiles
-- ================================================================

INSERT INTO public.profiles (id, email, full_name, phone, role, is_approved, worker_status, avatar_url, cedula_url, record_policia_url, category_1, category_2, category_1_approved, category_2_approved, stripe_account_id, fcm_token)
SELECT
  u.id,
  u.email,
  CASE u.email
    WHEN 'admin@chamba.com'   THEN 'Admin CHAMBA'
    WHEN 'tecnico@chamba.com' THEN 'Juan Técnico'
    WHEN 'cliente@chamba.com' THEN 'María Cliente'
  END,
  CASE u.email
    WHEN 'admin@chamba.com'   THEN '88881111'
    WHEN 'tecnico@chamba.com' THEN '88882222'
    WHEN 'cliente@chamba.com' THEN '88883333'
  END,
  CASE u.email
    WHEN 'admin@chamba.com'   THEN 'admin'
    WHEN 'tecnico@chamba.com' THEN 'worker'
    WHEN 'cliente@chamba.com' THEN 'client'
  END::user_role,
  CASE u.email
    WHEN 'admin@chamba.com'   THEN TRUE
    WHEN 'tecnico@chamba.com' THEN TRUE
    WHEN 'cliente@chamba.com' THEN TRUE
  END,
  CASE u.email
    WHEN 'tecnico@chamba.com' THEN 'approved'
    ELSE NULL
  END::worker_status_enum,
  NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, NULL, NULL
FROM auth.users u
WHERE u.email IN ('admin@chamba.com', 'tecnico@chamba.com', 'cliente@chamba.com')
ON CONFLICT (id) DO UPDATE SET
  role        = EXCLUDED.role,
  is_approved = EXCLUDED.is_approved,
  full_name   = EXCLUDED.full_name,
  phone       = EXCLUDED.phone,
  worker_status = EXCLUDED.worker_status;

-- ================================================================
-- PASO 3: Crear perfil extendido del técnico
-- ================================================================

INSERT INTO worker_profiles (worker_id, bio, skills, availability_status)
SELECT
  id,
  'Técnico de prueba con experiencia en electricidad y plomería.',
  ARRAY['electricidad', 'plomeria'],
  'available'
FROM public.profiles
WHERE email = 'tecnico@chamba.com'
ON CONFLICT (worker_id) DO UPDATE SET
  availability_status = 'available',
  bio = EXCLUDED.bio;

-- ================================================================
-- VERIFICACIÓN FINAL — Deberías ver 3 filas con los roles correctos
-- ================================================================

SELECT
  p.email,
  p.full_name,
  p.role,
  p.is_approved,
  p.worker_status,
  p.phone
FROM public.profiles p
WHERE p.email IN ('admin@chamba.com', 'tecnico@chamba.com', 'cliente@chamba.com')
ORDER BY p.role;
