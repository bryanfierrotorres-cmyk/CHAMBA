-- CHAMBA 074 — Fix RLS: Admin write en worker_profiles + Analytics siempre al activar fallback
SET statement_timeout = '60s';

-- ═══════════════════════════════════════════════════════════════
-- 1. RLS: Permitir al admin actualizar cualquier worker_profile
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "worker_profiles: admin write" ON worker_profiles;
CREATE POLICY "worker_profiles: admin write"
  ON worker_profiles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. Corregir calculate_job_dispatch_waves:
--    El evento analítico debe registrarse cuando el FALLBACK
--    se ACTIVA (no solo cuando encuentra técnicos), para poder
--    auditar también los casos de cobertura cero.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION calculate_job_dispatch_waves(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job             jobs%ROWTYPE;
  v_worker          RECORD;
  v_proximity_score NUMERIC;
  v_score           NUMERIC;
  v_distance_km     NUMERIC;
  v_results         JSONB  := '{}'::jsonb;
  v_workers_data    JSONB[] := ARRAY[]::JSONB[];
  v_total_workers   INT;
  v_wave            INT;
  v_rank            INT    := 0;

  v_beta_mode   BOOLEAN := false;
  v_radius_km   NUMERIC := 15;
  v_is_fallback BOOLEAN := false;
BEGIN
  -- ─── Leer la chamba ─────────────────────────────────────────
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  -- ─── Leer configuración ──────────────────────────────────────
  SELECT (value = 'true') INTO v_beta_mode FROM app_config WHERE key = 'beta_mode';
  SELECT value::NUMERIC   INTO v_radius_km  FROM app_config WHERE key = 'dispatch_radius_km';
  v_beta_mode := COALESCE(v_beta_mode, false);
  v_radius_km := COALESCE(v_radius_km, 15);

  -- ═══════════════════════════════════════════════════════════
  -- PASO 1 — Ruta Estricta: categoría exacta + disponible + radio
  -- ═══════════════════════════════════════════════════════════
  FOR v_worker IN (
    SELECT wp.*, p.full_name, p.category_1, p.category_2
    FROM worker_profiles wp
    JOIN profiles p ON p.id = wp.worker_id
    WHERE p.is_approved = true
      AND p.role::text = 'worker'
      AND wp.availability_status::text = 'available'
      AND wp.last_location_at >= NOW() - INTERVAL '30 minutes'
      AND wp.last_lat IS NOT NULL
      AND wp.last_lng IS NOT NULL
      AND (p.category_1 = v_job.category OR p.category_2 = v_job.category)
  ) LOOP
    v_distance_km := fn_haversine_km(v_job.lat, v_job.lng, v_worker.last_lat, v_worker.last_lng);
    CONTINUE WHEN v_distance_km > v_radius_km;

    IF    v_distance_km <= 2  THEN v_proximity_score := 1.0;
    ELSIF v_distance_km <= 5  THEN v_proximity_score := 0.7;
    ELSIF v_distance_km <= 10 THEN v_proximity_score := 0.4;
    ELSE                           v_proximity_score := 0.1;
    END IF;

    v_score :=
      (0.35 * COALESCE(v_worker.rating_avg,     5.0)) +
      (0.25 * COALESCE(v_worker.acceptance_rate, 1.0)) +
      (0.20 * v_proximity_score) +
      (0.20 * COALESCE(v_worker.completion_rate, 1.0));

    v_workers_data := array_append(v_workers_data, jsonb_build_object(
      'worker_id', v_worker.worker_id,
      'score',     v_score,
      'distance',  v_distance_km
    ));
  END LOOP;

  -- ═══════════════════════════════════════════════════════════
  -- PASO 2 — Fallback de Liquidez (beta_mode + pool estricto vacío)
  -- ═══════════════════════════════════════════════════════════
  IF array_length(v_workers_data, 1) IS NULL AND v_beta_mode THEN
    v_is_fallback  := true;
    v_workers_data := ARRAY[]::JSONB[];

    FOR v_worker IN (
      SELECT wp.*, p.full_name, p.category_1, p.category_2
      FROM worker_profiles wp
      JOIN profiles p ON p.id = wp.worker_id
      WHERE p.is_approved = true
        AND p.role::text = 'worker'
        AND wp.availability_status::text = 'available'
        AND wp.last_location_at >= NOW() - INTERVAL '30 minutes'
        AND wp.last_lat IS NOT NULL
        AND wp.last_lng IS NOT NULL
        -- Sin filtro de categoría
    ) LOOP
      v_distance_km := fn_haversine_km(v_job.lat, v_job.lng, v_worker.last_lat, v_worker.last_lng);
      CONTINUE WHEN v_distance_km > v_radius_km;

      IF    v_distance_km <= 2  THEN v_proximity_score := 1.0;
      ELSIF v_distance_km <= 5  THEN v_proximity_score := 0.7;
      ELSIF v_distance_km <= 10 THEN v_proximity_score := 0.4;
      ELSE                           v_proximity_score := 0.1;
      END IF;

      v_score :=
        (0.35 * COALESCE(v_worker.rating_avg,     5.0)) +
        (0.25 * COALESCE(v_worker.acceptance_rate, 1.0)) +
        (0.20 * v_proximity_score) +
        (0.20 * COALESCE(v_worker.completion_rate, 1.0));

      v_workers_data := array_append(v_workers_data, jsonb_build_object(
        'worker_id', v_worker.worker_id,
        'score',     v_score,
        'distance',  v_distance_km
      ));
    END LOOP;

    -- ✅ FIX: Registrar el evento analítico SIEMPRE que el fallback se active,
    --    independientemente de si se encontraron técnicos o no.
    INSERT INTO analytics_events (event_name, user_id, metadata)
    VALUES (
      'dispatch_fallback_activated',
      v_job.created_by,
      jsonb_build_object(
        'job_id',         p_job_id,
        'job_category',   v_job.category,
        'distance_limit', v_radius_km,
        'workers_found',  COALESCE(array_length(v_workers_data, 1), 0),
        'beta_mode',      true
      )
    );
  END IF;

  -- ─── Verificar pool final ─────────────────────────────────────
  v_total_workers := COALESCE(array_length(v_workers_data, 1), 0);

  IF v_total_workers = 0 THEN
    UPDATE jobs
    SET dispatch_data = jsonb_build_object(
          'is_fallback', v_is_fallback,
          'workers',     '{}'::jsonb,
          'pool_size',   0
        )
    WHERE id = p_job_id;
    RETURN jsonb_build_object('is_fallback', v_is_fallback, 'pool_size', 0, 'workers', '{}'::jsonb);
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- PASO 3 — Calcular Waves y construir mapa de despacho
  -- ═══════════════════════════════════════════════════════════
  FOR v_worker IN (
    SELECT
      elem->>'worker_id'           AS worker_id,
      (elem->>'score')::NUMERIC    AS score,
      (elem->>'distance')::NUMERIC AS distance
    FROM unnest(v_workers_data) AS elem
    ORDER BY (elem->>'score')::NUMERIC DESC
  ) LOOP
    v_rank := v_rank + 1;

    IF    v_rank <= CEIL(v_total_workers * 0.20) THEN v_wave := 1;
    ELSIF v_rank <= CEIL(v_total_workers * 0.50) THEN v_wave := 2;
    ELSIF v_worker.distance <= 10                THEN v_wave := 3;
    ELSE                                              v_wave := 4;
    END IF;

    v_results := jsonb_set(
      v_results,
      ARRAY[v_worker.worker_id],
      jsonb_build_object('wave', v_wave, 'score', ROUND(v_worker.score, 3))
    );
  END LOOP;

  -- ─── Persistir resultado ──────────────────────────────────────
  UPDATE jobs
  SET dispatch_data = jsonb_build_object(
        'is_fallback', v_is_fallback,
        'pool_size',   v_total_workers,
        'workers',     v_results
      )
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'is_fallback', v_is_fallback,
    'pool_size',   v_total_workers,
    'workers',     v_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_job_dispatch_waves(UUID) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
