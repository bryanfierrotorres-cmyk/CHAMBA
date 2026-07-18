-- =====================================================================
-- 086_create_phone_indexes.sql
-- Fase C — Índice sargable sobre phone_normalized.
--
-- OBJETIVO: habilitar Index Scan para el login (reemplaza el seq scan).
-- RIESGO: BAJO. CONCURRENTLY no toma AccessExclusiveLock.
-- TIEMPO: segundos. IMPACTO: cero downtime (lecturas/escrituras siguen).
-- IDEMPOTENTE: sí (IF NOT EXISTS).
-- REVERSIBLE: sí (DROP INDEX CONCURRENTLY).
--
-- ⚠️ EJECUCIÓN: CONCURRENTLY NO puede correr dentro de una transacción.
--    Ejecutar este archivo SOLO (no envuelto en BEGIN/COMMIT).
--    Si el comando falla a mitad, el índice queda INVALID:
--      DROP INDEX CONCURRENTLY IF EXISTS idx_profiles_phone_normalized;  -- y reintentar.
-- =====================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_phone_normalized
  ON profiles (phone_normalized);

-- =====================================================================
-- ROLLBACK:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_profiles_phone_normalized;
-- =====================================================================
