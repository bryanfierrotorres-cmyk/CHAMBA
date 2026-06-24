-- CHAMBA 062 — Sistema de Confianza y Perfil Avanzado

SET statement_timeout = '120s';

-- 1. Tabla de Portafolio
CREATE TABLE IF NOT EXISTS technician_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_before_url TEXT,
  image_after_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technician_portfolio_worker ON technician_portfolio(worker_id);

ALTER TABLE technician_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio: public read" ON technician_portfolio;
CREATE POLICY "portfolio: public read" ON technician_portfolio FOR SELECT USING (true);

DROP POLICY IF EXISTS "portfolio: owner insert" ON technician_portfolio;
CREATE POLICY "portfolio: owner insert" ON technician_portfolio FOR INSERT WITH CHECK (worker_id = auth.uid());

DROP POLICY IF EXISTS "portfolio: owner update" ON technician_portfolio;
CREATE POLICY "portfolio: owner update" ON technician_portfolio FOR UPDATE USING (worker_id = auth.uid()) WITH CHECK (worker_id = auth.uid());

DROP POLICY IF EXISTS "portfolio: owner delete" ON technician_portfolio;
CREATE POLICY "portfolio: owner delete" ON technician_portfolio FOR DELETE USING (worker_id = auth.uid());

-- 2. Recálculo Exacto de total_jobs_done
CREATE OR REPLACE FUNCTION fn_recalc_total_jobs_done(p_worker_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM job_assignments
  WHERE worker_id = p_worker_id AND completed_at IS NOT NULL;

  UPDATE worker_profiles
  SET total_jobs_done = COALESCE(v_count, 0)
  WHERE worker_id = p_worker_id;
END;
$$;

-- Trigger para recalcular total_jobs_done cada vez que cambia una asignación
CREATE OR REPLACE FUNCTION trg_job_assignments_recalc_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM fn_recalc_total_jobs_done(NEW.worker_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fn_recalc_total_jobs_done(OLD.worker_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_assignments_jobs_done ON job_assignments;
CREATE TRIGGER trg_job_assignments_jobs_done
  AFTER INSERT OR UPDATE OF completed_at OR DELETE
  ON job_assignments
  FOR EACH ROW EXECUTE FUNCTION trg_job_assignments_recalc_jobs();

-- 3. Distribución Airbnb-style (get_worker_reviews_stats)
CREATE OR REPLACE FUNCTION get_worker_reviews_stats(p_worker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC(3,2);
  v_total INTEGER;
  v_5 INT := 0; v_4 INT := 0; v_3 INT := 0; v_2 INT := 0; v_1 INT := 0;
BEGIN
  SELECT
    COALESCE(ROUND(AVG(rating)::numeric, 2), 0),
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE rating = 5),
    COUNT(*) FILTER (WHERE rating = 4),
    COUNT(*) FILTER (WHERE rating = 3),
    COUNT(*) FILTER (WHERE rating = 2),
    COUNT(*) FILTER (WHERE rating = 1)
  INTO v_avg, v_total, v_5, v_4, v_3, v_2, v_1
  FROM worker_reviews
  WHERE worker_id = p_worker_id;

  RETURN jsonb_build_object(
    'rating_avg', v_avg,
    'total_reviews', v_total,
    'distribution', jsonb_build_object(
      '5', v_5,
      '4', v_4,
      '3', v_3,
      '2', v_2,
      '1', v_1
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_worker_reviews_stats(UUID) TO authenticated, anon;

-- 4. Seguridad RLS: Bloqueo de campos críticos
CREATE OR REPLACE FUNCTION trg_protect_worker_profiles_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role::text INTO v_role FROM profiles WHERE id = auth.uid();
  
  IF auth.uid() IS NULL OR v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.id_verified IS DISTINCT FROM OLD.id_verified THEN
    RAISE EXCEPTION 'No tienes permisos para modificar tu estado de verificación';
  END IF;
  IF NEW.rating_avg IS DISTINCT FROM OLD.rating_avg THEN
    RAISE EXCEPTION 'No tienes permisos para modificar tu calificación';
  END IF;
  IF NEW.total_reviews IS DISTINCT FROM OLD.total_reviews THEN
    RAISE EXCEPTION 'No tienes permisos para modificar tu conteo de reseñas';
  END IF;
  IF NEW.total_jobs_done IS DISTINCT FROM OLD.total_jobs_done THEN
    RAISE EXCEPTION 'No tienes permisos para modificar tu conteo de trabajos';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_profiles_security ON worker_profiles;
CREATE TRIGGER trg_worker_profiles_security
  BEFORE UPDATE ON worker_profiles
  FOR EACH ROW EXECUTE FUNCTION trg_protect_worker_profiles_fields();
