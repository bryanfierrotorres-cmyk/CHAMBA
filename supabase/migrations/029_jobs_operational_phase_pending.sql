-- CHAMBA 029 — Columna operational_phase con valor inicial 'pending' al publicar
SET statement_timeout = '120s';

-- Agregar la columna faltante que la app está exigiendo para poder publicar
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS operational_phase TEXT DEFAULT 'pending';

-- Ampliar CHECK existente: 'pending' = recién publicada, sin técnico asignado aún
DO $$
BEGIN
  ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_operational_phase_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_operational_phase_check
  CHECK (
    operational_phase IS NULL
    OR operational_phase IN (
      'pending',
      'accepted',
      'en_route',
      'arrived',
      'completed'
    )
  );

-- Asegurar default en columnas ya existentes (ADD IF NOT EXISTS no lo actualiza)
ALTER TABLE jobs
  ALTER COLUMN operational_phase SET DEFAULT 'pending';

-- Asegurar que los registros existentes no queden en blanco
UPDATE jobs
SET operational_phase = 'pending'
WHERE operational_phase IS NULL;
