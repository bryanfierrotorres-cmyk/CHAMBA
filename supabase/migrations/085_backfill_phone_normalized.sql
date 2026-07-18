-- =====================================================================
-- 085_backfill_phone_normalized.sql
-- Fase B — Backfill idempotente de phone_normalized en filas existentes.
--
-- OBJETIVO: poblar phone_normalized para los perfiles ya creados.
-- RIESGO: BAJO. Solo UPDATE de una columna nueva; no toca `phone`.
-- TIEMPO: < 1s con el volumen actual (~15 filas). En tablas grandes,
--         ejecutar por lotes (ver variante comentada).
-- IDEMPOTENTE: sí — el WHERE evita reescribir filas ya normalizadas.
-- REVERSIBLE: sí (UPDATE ... SET phone_normalized = NULL).
-- =====================================================================

UPDATE profiles
   SET phone_normalized = normalize_phone_digits(phone)
 WHERE phone IS NOT NULL
   AND phone_normalized IS DISTINCT FROM normalize_phone_digits(phone);

-- --- Variante por lotes para tablas grandes (opcional) ---------------
-- DO $$
-- DECLARE v_rows INT;
-- BEGIN
--   LOOP
--     UPDATE profiles SET phone_normalized = normalize_phone_digits(phone)
--      WHERE id IN (
--        SELECT id FROM profiles
--         WHERE phone IS NOT NULL
--           AND phone_normalized IS DISTINCT FROM normalize_phone_digits(phone)
--         LIMIT 5000
--      );
--     GET DIAGNOSTICS v_rows = ROW_COUNT;
--     EXIT WHEN v_rows = 0;
--   END LOOP;
-- END $$;

-- =====================================================================
-- ROLLBACK:
-- UPDATE profiles SET phone_normalized = NULL;
-- =====================================================================
