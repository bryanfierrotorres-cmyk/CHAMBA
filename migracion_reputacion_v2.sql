-- =====================================================================
-- migracion_reputacion_v2.sql
-- Sistema de Reputación Bidireccional (Cliente <-> Técnico)
-- Arquitectura: Modelo Polimórfico de Reviews (RFC Opción B)
--
-- PRINCIPIO: 100% aditivo / backward-compatible.
-- El frontend ACTUAL sigue funcionando sin cambios tras aplicar esto.
-- Reutiliza la tabla worker_reviews, el RPC submit_worker_review y el
-- trigger fn_refresh_worker_rating existentes. NO crea tablas/RPC nuevos.
--
-- Ejecución sugerida: SQL Editor de Supabase (todo en una transacción).
-- =====================================================================

BEGIN;

-- =====================================================================
-- FASE 1 — MIGRACIÓN DE ESQUEMA (solo backward-compatible)
-- =====================================================================

-- 1.1 worker_reviews: sujeto polimórfico.
--     worker_id se conserva (compatibilidad) y pasa a significar "subject_id".
ALTER TABLE worker_reviews
  ADD COLUMN IF NOT EXISTS subject_role TEXT NOT NULL DEFAULT 'worker';

-- CHECK de subject_role con nombre explícito (idempotente).
ALTER TABLE worker_reviews
  DROP CONSTRAINT IF EXISTS worker_reviews_subject_role_check;
ALTER TABLE worker_reviews
  ADD CONSTRAINT worker_reviews_subject_role_check
  CHECK (subject_role IN ('worker', 'client'));

-- 1.2 worker_reviews: ampliar reviewer_role para aceptar 'worker'.
--     Superconjunto del CHECK original ('admin','client') -> nada se rechaza.
ALTER TABLE worker_reviews
  DROP CONSTRAINT IF EXISTS worker_reviews_reviewer_role_check;
ALTER TABLE worker_reviews
  ADD CONSTRAINT worker_reviews_reviewer_role_check
  CHECK (reviewer_role IN ('admin', 'client', 'worker'));

-- 1.3 profiles: destino de la reputación del CLIENTE.
--     (Los técnicos siguen usando worker_profiles.rating_avg / total_reviews.)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3, 2);
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_reviews INTEGER NOT NULL DEFAULT 0;


-- =====================================================================
-- FASE 3 — TRIGGER POLIMÓRFICO (se define antes que el RPC porque éste lo invoca)
-- fn_refresh_worker_rating: enruta el promedio según el rol del sujeto.
--   - sujeto worker  -> worker_profiles  (rama original, sin cambios funcionales)
--   - sujeto client  -> profiles
-- El rol se determina desde profiles.role del sujeto (robusto ante 0 reseñas).
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_refresh_worker_rating(p_worker UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg          NUMERIC;
  v_cnt          INTEGER;
  v_subject_role TEXT;
BEGIN
  SELECT role INTO v_subject_role FROM profiles WHERE id = p_worker;

  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)::int
    INTO v_avg, v_cnt
    FROM worker_reviews
   WHERE worker_id = p_worker;

  IF v_subject_role = 'client' THEN
    -- Reputación del cliente -> profiles
    UPDATE profiles
       SET rating_avg    = v_avg,
           total_reviews = COALESCE(v_cnt, 0)
     WHERE id = p_worker;
  ELSE
    -- Reputación del técnico -> worker_profiles (comportamiento original)
    UPDATE worker_profiles
       SET rating_avg    = v_avg,
           total_reviews = COALESCE(v_cnt, 0),
           updated_at    = NOW()
     WHERE worker_id = p_worker;

    IF NOT FOUND THEN
      INSERT INTO worker_profiles (worker_id, skills, total_reviews, availability_status)
      VALUES (p_worker, '{}', COALESCE(v_cnt, 0), 'offline')
      ON CONFLICT (worker_id) DO UPDATE
        SET rating_avg    = v_avg,
            total_reviews = COALESCE(v_cnt, 0),
            updated_at    = NOW();
    END IF;
  END IF;
END;
$$;

-- El trigger trg_worker_reviews_rating (de 007) NO cambia: ya invoca
-- fn_refresh_worker_rating en AFTER INSERT/UPDATE/DELETE. Se reafirma por idempotencia.
DROP TRIGGER IF EXISTS trg_worker_reviews_rating ON worker_reviews;
CREATE TRIGGER trg_worker_reviews_rating
  AFTER INSERT OR UPDATE OR DELETE ON worker_reviews
  FOR EACH ROW EXECUTE FUNCTION trg_worker_reviews_refresh_rating();


-- =====================================================================
-- FASE 2 — RPC submit_worker_review (parámetro p_subject_role al final)
-- Compatibilidad: PostgREST llama por nombre; la llamada actual de 5 args
-- omite p_subject_role y toma el DEFAULT 'worker' -> comportamiento idéntico.
-- Se hace DROP de la firma vieja (5 args) para evitar overload ambiguo.
-- =====================================================================
DROP FUNCTION IF EXISTS submit_worker_review(UUID, UUID, TEXT, INTEGER, TEXT);

CREATE FUNCTION submit_worker_review(
  p_worker_id     UUID,
  p_reviewer_id   UUID,
  p_reviewer_role TEXT,
  p_rating        INTEGER,
  p_comment       TEXT,
  p_subject_role  TEXT DEFAULT 'worker'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row worker_reviews%ROWTYPE;
BEGIN
  -- Validaciones de entrada (rango y comentario) — sin cambios respecto al original.
  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La calificación debe ser entre 1 y 5');
  END IF;
  IF char_length(trim(p_comment)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El comentario debe tener al menos 3 caracteres');
  END IF;
  IF p_subject_role NOT IN ('worker', 'client') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rol del sujeto inválido');
  END IF;

  -- Validación del SUJETO según subject_role.
  IF p_subject_role = 'worker'
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_worker_id AND role = 'worker') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajador no encontrado');
  END IF;
  IF p_subject_role = 'client'
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_worker_id AND role = 'client') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
  END IF;

  -- Revisor debe existir y tener rol válido.
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_reviewer_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil del revisor no encontrado');
  END IF;
  IF p_reviewer_role NOT IN ('admin', 'client', 'worker') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rol de revisor inválido');
  END IF;

  -- Upsert: 1 reseña por par (sujeto, revisor). Mantiene la lógica original.
  INSERT INTO worker_reviews (worker_id, reviewer_id, reviewer_role, rating, comment, subject_role)
  VALUES (p_worker_id, p_reviewer_id, p_reviewer_role, p_rating, trim(p_comment), p_subject_role)
  ON CONFLICT (worker_id, reviewer_id) DO UPDATE
    SET rating        = EXCLUDED.rating,
        comment       = EXCLUDED.comment,
        reviewer_role = EXCLUDED.reviewer_role,
        subject_role  = EXCLUDED.subject_role,
        updated_at    = NOW()
  RETURNING * INTO v_row;

  -- Recalcular promedio del sujeto (worker o client) vía función polimórfica.
  PERFORM fn_refresh_worker_rating(p_worker_id);

  RETURN jsonb_build_object('success', true, 'review', to_jsonb(v_row));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_worker_review(UUID, UUID, TEXT, INTEGER, TEXT, TEXT) TO anon, authenticated;


-- =====================================================================
-- FASE 4 — RLS
-- Lectura pública de reseñas (sin cambios). Escritura vía RPC SECURITY DEFINER.
-- Se reafirma por idempotencia.
-- =====================================================================
ALTER TABLE worker_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews: public read" ON worker_reviews;
CREATE POLICY "reviews: public read"
  ON worker_reviews FOR SELECT
  USING (true);

COMMIT;


-- =====================================================================
-- VERIFICACIÓN POST-EJECUCIÓN (opcional, ejecutar por separado)
-- =====================================================================
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'worker_reviews' AND column_name = 'subject_role';
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'profiles' AND column_name IN ('rating_avg','total_reviews');
--
-- SELECT pg_get_functiondef('submit_worker_review(uuid,uuid,text,integer,text,text)'::regprocedure);


-- =====================================================================
-- PLAN DE ROLLBACK (NO ejecutar salvo necesidad — está comentado a propósito)
-- Orden inverso. Requiere snapshot previo de worker_reviews y worker_profiles.
-- =====================================================================
-- BEGIN;
--   -- Restaurar RPC original (5 args). Recrea el cuerpo de la migración 007.
--   DROP FUNCTION IF EXISTS submit_worker_review(UUID,UUID,TEXT,INTEGER,TEXT,TEXT);
--   -- (volver a crear submit_worker_review de 5 args desde 007_worker_reviews.sql)
--
--   -- Restaurar trigger fn original (solo worker_profiles) desde 007_worker_reviews.sql.
--   -- (CREATE OR REPLACE FUNCTION fn_refresh_worker_rating ... versión 007)
--
--   -- Quitar reputación de clientes (solo si NO se desea conservar):
--   --   Si existen filas con subject_role='client', decidir purgar o conservar antes.
--   DELETE FROM worker_reviews WHERE subject_role = 'client';   -- opcional
--   ALTER TABLE profiles DROP COLUMN IF EXISTS rating_avg;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS total_reviews;
--
--   ALTER TABLE worker_reviews DROP CONSTRAINT IF EXISTS worker_reviews_reviewer_role_check;
--   ALTER TABLE worker_reviews ADD CONSTRAINT worker_reviews_reviewer_role_check
--     CHECK (reviewer_role IN ('admin','client'));
--
--   ALTER TABLE worker_reviews DROP CONSTRAINT IF EXISTS worker_reviews_subject_role_check;
--   ALTER TABLE worker_reviews DROP COLUMN IF EXISTS subject_role;
-- COMMIT;
