-- CHAMBA 075 — Fix: garantizar fn_haversine_km y trg_dispatch_new_job en search_path correcto
SET statement_timeout = '60s';

-- Recrear fn_haversine_km con SET search_path explícito para que sea
-- accesible desde triggers SECURITY DEFINER
CREATE OR REPLACE FUNCTION fn_haversine_km(
  p_lat1 DOUBLE PRECISION,
  p_lng1 DOUBLE PRECISION,
  p_lat2 DOUBLE PRECISION,
  p_lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_lat1 IS NULL OR p_lng1 IS NULL OR p_lat2 IS NULL OR p_lng2 IS NULL THEN NULL
    WHEN NOT (ABS(p_lat1) > 0.0001 OR ABS(p_lng1) > 0.0001) THEN NULL
    WHEN NOT (ABS(p_lat2) > 0.0001 OR ABS(p_lng2) > 0.0001) THEN NULL
    ELSE (
      6371.0 * 2.0 * ASIN(SQRT(
        POWER(SIN(RADIANS(p_lat2 - p_lat1) / 2.0), 2)
        + COS(RADIANS(p_lat1)) * COS(RADIANS(p_lat2))
        * POWER(SIN(RADIANS(p_lng2 - p_lng1) / 2.0), 2)
      ))
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION fn_haversine_km(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO authenticated, anon, service_role;

-- Recrear el trigger wrapper con search_path explícito
CREATE OR REPLACE FUNCTION trg_dispatch_new_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM calculate_job_dispatch_waves(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_job_dispatch ON jobs;
CREATE TRIGGER trigger_job_dispatch
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trg_dispatch_new_job();

NOTIFY pgrst, 'reload schema';
