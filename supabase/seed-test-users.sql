-- ================================================================
-- CHAMBA — Usuarios de prueba (ejecutar en Supabase SQL Editor)
-- ================================================================
-- IMPORTANTE: Primero crea los usuarios en:
--   Dashboard → Authentication → Users → Add user → Create new user
--
-- Usuarios a crear manualmente (marca "Auto Confirm User"):
--   Credenciales piloto: ver EXPO_PUBLIC_PILOT_* en .env (no commitear contraseñas)
--
-- Luego ejecuta este SQL:
-- ================================================================

-- 1. Perfiles (ajusta roles y aprobaciones)
UPDATE profiles
SET role = 'admin', is_approved = TRUE, full_name = 'Admin CHAMBA', phone = '5512345678'
WHERE email = 'admin@chamba.com';

UPDATE profiles
SET role = 'worker', is_approved = TRUE, full_name = 'Juan Trabajador', phone = '5512345679'
WHERE email = 'worker1@chamba.com';

UPDATE profiles
SET role = 'worker', is_approved = FALSE, full_name = 'María Pendiente', phone = '5512345680'
WHERE email = 'worker2@chamba.com';

-- 2. Worker profiles extendidos
INSERT INTO worker_profiles (worker_id, bio, skills, availability_status)
SELECT id, 'Trabajador de prueba con experiencia en carga y mudanzas.', ARRAY['carga','mudanza'], 'available'
FROM profiles WHERE email = 'worker1@chamba.com'
ON CONFLICT (worker_id) DO UPDATE SET availability_status = 'available';

INSERT INTO worker_profiles (worker_id, bio, skills, availability_status)
SELECT id, 'Trabajadora nueva, pendiente de aprobación.', ARRAY['limpieza'], 'offline'
FROM profiles WHERE email = 'worker2@chamba.com'
ON CONFLICT (worker_id) DO NOTHING;

-- 3. Chambas de ejemplo (solo si no existen)
INSERT INTO jobs (
  title, description, category, status,
  pay_amount, platform_fee, worker_payout,
  address, lat, lng, duration_hours, required_workers, created_by
)
SELECT
  v.title, v.description, v.category::job_category, 'open'::job_status,
  v.pay_amount, v.platform_fee, v.worker_payout,
  v.address, v.lat, v.lng, v.duration_hours, v.required_workers,
  p.id
FROM profiles p
CROSS JOIN (VALUES
  (
    'Carga de materiales en bodega',
    'Cargar 200 sacos de cemento de 50kg del camión a la bodega.',
    'carga', 850.00, 42.50, 807.50,
    'Av. Insurgentes Sur 1234, CDMX', 19.3893, -99.1729, 6.0, 2
  ),
  (
    'Limpieza post-obra departamento',
    'Limpieza profunda de departamento de 80m² recién terminado.',
    'limpieza', 600.00, 30.00, 570.00,
    'Col. Polanco, CDMX', 19.4324, -99.1977, 4.0, 1
  ),
  (
    'Mudanza oficina piso 3',
    'Bajar muebles de oficina del 3er piso a camioneta. Sin elevador.',
    'mudanza', 1200.00, 60.00, 1140.00,
    'Centro Histórico, CDMX', 19.4326, -99.1332, 3.0, 3
  )
) AS v(title, description, category, pay_amount, platform_fee, worker_payout, address, lat, lng, duration_hours, required_workers)
WHERE p.email = 'admin@chamba.com'
  AND NOT EXISTS (SELECT 1 FROM jobs LIMIT 1);

-- Verificación
SELECT email, role, is_approved FROM profiles
WHERE email IN ('admin@chamba.com','worker1@chamba.com','worker2@chamba.com');
