-- 092_storage_buckets.sql
-- Cierra el DRIFT de Storage: los 3 buckets que usa la app fueron creados a mano
-- en el panel web y nunca quedaron en migraciones. Esto los versiona para que
-- Supabase local (y una restauración de producción) los reproduzca desde cero.
--
-- NOTA: reconstrucción razonable. El código usa getPublicUrl en los 3 → públicos.
-- Path por convención: {userId}/... para perfil y worker-documents; {jobId}/... para fotos.
-- Idempotente (ON CONFLICT / IF NOT EXISTS).

-- ─── 1. Buckets ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('perfil',          'perfil',          true),
  ('worker-documents','worker-documents',true),
  ('job-work-photos', 'job-work-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ─── 2. Políticas RLS de storage.objects ──────────────────────────────────
-- Lectura pública (los tres buckets se leen vía getPublicUrl).
-- Escritura (INSERT/UPDATE) solo para usuarios autenticados.

DO $$
DECLARE
  b TEXT;
  buckets TEXT[] := ARRAY['perfil', 'worker-documents', 'job-work-photos'];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    -- SELECT público
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = format('public_read_%s', b)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L)',
        format('public_read_%s', b), b
      );
    END IF;

    -- INSERT autenticado
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = format('auth_insert_%s', b)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR INSERT WITH CHECK (bucket_id = %L AND auth.role() = %L)',
        format('auth_insert_%s', b), b, 'authenticated'
      );
    END IF;

    -- UPDATE autenticado
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = format('auth_update_%s', b)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR UPDATE USING (bucket_id = %L AND auth.role() = %L)',
        format('auth_update_%s', b), b, 'authenticated'
      );
    END IF;
  END LOOP;
END
$$;

-- ─── 3. Verificación ───────────────────────────────────────────────────────
SELECT id, public FROM storage.buckets
WHERE id IN ('perfil', 'worker-documents', 'job-work-photos')
ORDER BY id;
-- Esperado: 3 filas, todas public = true
