-- =====================================================================
-- 088_unique_phone_constraint.sql
-- Fase E — Resolución del duplicado + restricción UNIQUE.
--
-- DECISIÓN DEL OPERADOR (2026-06-26):
--   Conservar  "Cliente de Prueba"  b0332110-9d62-46f4-89d2-d4139d9a98e3
--   Eliminar   "Maria Cliente"      d53db136-71cb-441d-bd11-772abf8e90bc
--
-- OBJETIVO: 1 perfil por teléfono (login determinístico) sin perder datos
--           del técnico calificado.
-- RIESGO: MEDIO (DELETE de perfil). Mitigado: se reasignan sus referencias
--         al registro conservado ANTES de borrar (Zero Data Loss del historial).
-- TIEMPO: < 1s. IMPACTO: ninguno en otros usuarios.
-- REVERSIBLE: parcialmente — el DELETE no es reversible salvo por backup.
--             ⚠️ Hacer pg_dump de profiles + worker_reviews + jobs antes.
--
-- Hechos verificados:
--   - Maria dio 1 reseña (worker_reviews 183da5e0 → worker 78ae307b, rating 4).
--   - "Cliente de Prueba" NO reseñó a ese worker → reasignar NO viola el
--     UNIQUE(worker_id, reviewer_id).
-- =====================================================================

-- ---- PASO 1: resolución del duplicado (atómico) ----------------------
BEGIN;

  -- 1a. Preservar la reseña de Maria reasignándola al registro conservado
  --     (mismo teléfono = misma persona).
  UPDATE worker_reviews
     SET reviewer_id = 'b0332110-9d62-46f4-89d2-d4139d9a98e3'
   WHERE reviewer_id = 'd53db136-71cb-441d-bd11-772abf8e90bc';

  -- 1b. Reasignar cualquier job creado por Maria (evita filas huérfanas;
  --     jobs.created_by es NOT NULL sin ON DELETE CASCADE).
  UPDATE jobs
     SET created_by = 'b0332110-9d62-46f4-89d2-d4139d9a98e3'
   WHERE created_by = 'd53db136-71cb-441d-bd11-772abf8e90bc';

  -- 1c. (Defensa extra) cualquier otra referencia conocida a profiles.id.
  --     Descomentar si aplica en tu esquema:
  -- UPDATE job_assignments SET worker_id = 'b0332110-...' WHERE worker_id = 'd53db136-...';

  -- 1d. Eliminar el perfil duplicado.
  DELETE FROM profiles
   WHERE id = 'd53db136-71cb-441d-bd11-772abf8e90bc';

COMMIT;

-- ---- PASO 2: restricción UNIQUE --------------------------------------
-- ⚠️ CONCURRENTLY → ejecutar FUERA de transacción (en un envío separado).
-- Partial UNIQUE: ignora phone_normalized NULL (cuentas E2E sin teléfono).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_phone_normalized_uniq
  ON profiles (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

-- =====================================================================
-- ROLLBACK:
--   DROP INDEX CONCURRENTLY IF EXISTS idx_profiles_phone_normalized_uniq;
--   -- El perfil eliminado solo se recupera desde el backup previo (pg_dump).
-- =====================================================================
