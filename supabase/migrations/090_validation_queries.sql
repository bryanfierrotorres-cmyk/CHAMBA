-- =====================================================================
-- 090_validation_queries.sql
-- Fase G — Validación post-migración (SOLO LECTURA).
-- Ejecutar tras 084–089 para confirmar el resultado esperado.
-- =====================================================================

-- 1. El plan usa Index Scan (NO Seq Scan) sobre idx_profiles_phone_normalized.
EXPLAIN ANALYZE
SELECT * FROM profiles WHERE phone_normalized = '88883333';

-- 2. Cero duplicados restantes.
SELECT phone_normalized, COUNT(*)
  FROM profiles
 WHERE phone_normalized IS NOT NULL
 GROUP BY phone_normalized
HAVING COUNT(*) > 1;
-- Esperado: 0 filas.

-- 3. Backfill completo (ningún teléfono sin normalizar).
SELECT COUNT(*) AS sin_normalizar
  FROM profiles
 WHERE phone IS NOT NULL AND phone_normalized IS NULL;
-- Esperado: 0.

-- 4. El RPC responde correctamente para ambos formatos.
SELECT get_profile_by_phone('88883333') IS NOT NULL AS encuentra_sin_guion;
SELECT get_profile_by_phone('8888-3333') IS NOT NULL AS encuentra_con_guion;
-- Esperado: ambos true.

-- 5. Índices presentes.
SELECT indexname FROM pg_indexes
 WHERE tablename = 'profiles' AND indexname LIKE '%phone_normalized%';
-- Esperado: idx_profiles_phone_normalized (+ _uniq tras 088).
-- =====================================================================
