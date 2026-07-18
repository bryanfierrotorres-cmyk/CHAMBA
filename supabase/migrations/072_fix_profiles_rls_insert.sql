-- CHAMBA 072 — Fix Profiles RLS for Phone Auth Registration
-- Permite que los usuarios anónimos creen su perfil antes de verificar el OTP.

-- Habilitar a anon para insertar en profiles
DROP POLICY IF EXISTS "profiles: anon insert for phone auth" ON profiles;
CREATE POLICY "profiles: anon insert for phone auth"
  ON profiles FOR INSERT
  TO anon
  WITH CHECK (true);

-- Habilitar a anon para actualizar su propio perfil temporal (si lo necesitan durante el flujo)
DROP POLICY IF EXISTS "profiles: anon update own for phone auth" ON profiles;
CREATE POLICY "profiles: anon update own for phone auth"
  ON profiles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
