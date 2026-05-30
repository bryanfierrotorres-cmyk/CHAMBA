-- ================================================================
--  Migración 001 — Fase 2: Sistema de Disponibilidad
--  Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Crear tipo ENUM para disponibilidad (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_status') THEN
    CREATE TYPE availability_status AS ENUM ('available', 'busy', 'offline');
  END IF;
END$$;

-- 2. Agregar columna a worker_profiles
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS availability_status availability_status NOT NULL DEFAULT 'offline';

-- 3. Índice para filtrar workers disponibles en el feed de admin
CREATE INDEX IF NOT EXISTS worker_profiles_availability_idx
  ON worker_profiles(availability_status)
  WHERE availability_status = 'available';

-- 4. Exponer la nueva columna en Realtime (ya está en la publicación si worker_profiles fue agregada)
-- Si worker_profiles aún no está en la publicación de Realtime, ejecutar:
-- ALTER PUBLICATION supabase_realtime ADD TABLE worker_profiles;

-- ================================================================
-- Verificación rápida post-migración:
-- SELECT worker_id, availability_status FROM worker_profiles LIMIT 5;
-- ================================================================
