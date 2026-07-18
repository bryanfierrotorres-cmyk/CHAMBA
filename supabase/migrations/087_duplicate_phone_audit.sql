-- =====================================================================
-- 087_duplicate_phone_audit.sql
-- Fase D — Auditoría de duplicados (SOLO LECTURA — NO modifica datos).
--
-- OBJETIVO: listar teléfonos duplicados antes de imponer UNIQUE.
-- RIESGO: NULO (solo SELECT).
-- Ejecutar y revisar el resultado ANTES de aplicar 088.
-- =====================================================================

-- 1. Duplicados por teléfono normalizado.
SELECT phone_normalized,
       COUNT(*)              AS total,
       array_agg(id)         AS ids,
       array_agg(full_name)  AS nombres,
       array_agg(role)       AS roles,
       array_agg(created_at) AS creados
  FROM profiles
 WHERE phone_normalized IS NOT NULL
 GROUP BY phone_normalized
HAVING COUNT(*) > 1
 ORDER BY total DESC;

-- 2. Referencias FK de cada registro duplicado (para decidir cuál conservar).
--    Repetir cambiando :id por cada UUID listado arriba.
-- SELECT
--   (SELECT COUNT(*) FROM jobs            WHERE created_by        = :id) AS jobs_creados,
--   (SELECT COUNT(*) FROM jobs            WHERE assigned_worker_id= :id) AS jobs_asignados,
--   (SELECT COUNT(*) FROM worker_reviews  WHERE reviewer_id       = :id) AS resenas_dadas,
--   (SELECT COUNT(*) FROM worker_reviews  WHERE worker_id         = :id) AS resenas_recibidas,
--   (SELECT COUNT(*) FROM job_assignments WHERE worker_id         = :id) AS asignaciones;

-- ---------------------------------------------------------------------
-- ESTADO CONOCIDO (auditoría 2026-06-26):
--   phone_normalized = '88883333'  x2
--     - b0332110-...  "Cliente de Prueba" (client)  created 20:16  | 0 referencias
--     - d53db136-...  "Maria Cliente"     (client)  created 08:16  | 1 reseña dada
-- =====================================================================
