-- CHAMBA 073 — Fallback Inteligente con Modo Beta y Analíticas
SET statement_timeout = '120s';

-- ═══════════════════════════════════════════════════════════════
-- 1. TABLA app_config (Feature Flags en caliente)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar flag beta_mode = true por defecto (activado para fase Beta)
INSERT INTO app_config (key, value, description)
VALUES (
  'beta_mode',
  'true',
  'Activa el Fallback de Liquidez: si no hay técnicos de la categoría exacta, abre el pool a todos los disponibles en el radio.'
)
ON CONFLICT (key) DO NOTHING;

-- Insertar radio de cobertura base (15 km)
INSERT INTO app_config (key, value, description)
VALUES (
  'dispatch_radius_km',
  '15',
  'Radio máximo de búsqueda de técnicos para despacho (kilómetros).'
)
ON CONFLICT (key) DO NOTHING;

-- RLS: solo admin puede modificar; todo el sistema puede leer (SECURITY DEFINER en funciones)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config: public read" ON app_config;
CREATE POLICY "app_config: public read"
  ON app_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_config: admin write" ON app_config;
CREATE POLICY "app_config: admin write"
  ON app_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- ═══════════════════════════════════════════════════════════════
-- 2. REFACTOR calculate_job_dispatch_waves — Two-Pass Routing
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_job_dispatch_waves(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job            jobs%ROWTYPE;
  v_worker         RECORD;
  v_proximity_score NUMERIC;
  v_score          NUMERIC;
  v_distance_km    NUMERIC;
  v_results        JSONB := '{}'::jsonb;
  v_workers_data   JSONB[] := ARRAY[]::JSONB[];
  v_total_workers  INT;
  v_wave           INT;
  v_rank           INT := 0;

  -- Configuración en caliente
  v_beta_mode      BOOLEAN := false;
  v_radius_km      NUMERIC := 15;
  v_is_fallback    BOOLEAN := false;
BEGIN
  -- ─── Leer la chamba ────────────────────────────────────────────
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  -- ─── Leer configuración desde app_config ───────────────────────
  SELECT (value = 'true')
    INTO v_beta_mode
    FROM app_config WHERE key = 'beta_mode';

  SELECT value::NUMERIC
    INTO v_radius_km
    FROM app_config WHERE key = 'dispatch_radius_km';

  -- Defaults de seguridad si app_config aún no tiene datos
  v_beta_mode  := COALESCE(v_beta_mode, false);
  v_radius_km  := COALESCE(v_radius_km, 15);

  -- ═══════════════════════════════════════════════════════════════
  -- PASO 1 — Ruta Estricta: misma categoría + activo + en radio
  -- ═══════════════════════════════════════════════════════════════
  FOR v_worker IN (
    SELECT wp.*, p.full_name, p.category_1, p.category_2
    FROM worker_profiles wp
    JOIN profiles p ON p.id = wp.worker_id
    WHERE p.is_approved = true
      AND p.role::text = 'worker'
      AND wp.availability_status::text IN ('available')
      AND wp.last_location_at >= NOW() - INTERVAL '30 minutes'
      AND wp.last_lat IS NOT NULL
      AND wp.last_lng IS NOT NULL
      -- Filtro de categoría estricta
      AND (
        p.category_1 = v_job.category
        OR p.category_2 = v_job.category
      )
  ) LOOP
    -- Distancia haversine
    v_distance_km := fn_haversine_km(v_job.lat, v_job.lng, v_worker.last_lat, v_worker.last_lng);

    -- Descartar técnicos fuera del radio
    CONTINUE WHEN v_distance_km > v_radius_km;

    -- Proximity score
    IF    v_distance_km <= 2  THEN v_proximity_score := 1.0;
    ELSIF v_distance_km <= 5  THEN v_proximity_score := 0.7;
    ELSIF v_distance_km <= 10 THEN v_proximity_score := 0.4;
    ELSE                           v_proximity_score := 0.1;
    END IF;

    -- Score lineal
    v_score := (0.35 * COALESCE(v_worker.rating_avg,     5.0)) +
               (0.25 * COALESCE(v_worker.acceptance_rate, 1.0)) +
               (0.20 * v_proximity_score) +
               (0.20 * COALESCE(v_worker.completion_rate, 1.0));

    v_workers_data := array_append(v_workers_data, jsonb_build_object(
      'worker_id', v_worker.worker_id,
      'score',     v_score,
      'distance',  v_distance_km
    ));
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════
  -- PASO 2 — Fallback de Liquidez (solo si beta_mode y pool vacío)
  -- ═══════════════════════════════════════════════════════════════
  IF array_length(v_workers_data, 1) IS NULL AND v_beta_mode THEN
    v_is_fallback := true;
    v_workers_data := ARRAY[]::JSONB[]; -- reiniciar por seguridad

    FOR v_worker IN (
      SELECT wp.*, p.full_name, p.category_1, p.category_2
      FROM worker_profiles wp
      JOIN profiles p ON p.id = wp.worker_id
      WHERE p.is_approved = true
        AND p.role::text = 'worker'
        AND wp.availability_status::text IN ('available')
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

      v_score := (0.35 * COALESCE(v_worker.rating_avg,     5.0)) +
                 (0.25 * COALESCE(v_worker.acceptance_rate, 1.0)) +
                 (0.20 * v_proximity_score) +
                 (0.20 * COALESCE(v_worker.completion_rate, 1.0));

      v_workers_data := array_append(v_workers_data, jsonb_build_object(
        'worker_id', v_worker.worker_id,
        'score',     v_score,
        'distance',  v_distance_km
      ));
    END LOOP;

    -- Registrar evento analítico si el fallback encontró técnicos
    IF array_length(v_workers_data, 1) IS NOT NULL THEN
      INSERT INTO analytics_events (event_name, user_id, metadata)
      VALUES (
        'dispatch_fallback_activated',
        v_job.created_by,
        jsonb_build_object(
          'job_id',         p_job_id,
          'job_category',   v_job.category,
          'distance_limit', v_radius_km,
          'workers_found',  array_length(v_workers_data, 1),
          'beta_mode',      true
        )
      );
    END IF;
  END IF;

  -- ─── Verificar pool final ──────────────────────────────────────
  v_total_workers := COALESCE(array_length(v_workers_data, 1), 0);

  IF v_total_workers = 0 THEN
    -- Sin técnicos disponibles: guardamos metadata de fallback vacío
    UPDATE jobs
    SET dispatch_data = jsonb_build_object(
          'is_fallback', v_is_fallback,
          'workers',     '{}'::jsonb,
          'pool_size',   0
        )
    WHERE id = p_job_id;
    RETURN '{}'::jsonb;
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- PASO 3 — Calcular Waves y construir mapa de despacho
  -- ═══════════════════════════════════════════════════════════════
  FOR v_worker IN (
    SELECT
      elem->>'worker_id' AS worker_id,
      (elem->>'score')::NUMERIC    AS score,
      (elem->>'distance')::NUMERIC AS distance
    FROM unnest(v_workers_data) AS elem
    ORDER BY (elem->>'score')::NUMERIC DESC
  ) LOOP
    v_rank := v_rank + 1;

    IF v_rank <= CEIL(v_total_workers * 0.20) THEN
      v_wave := 1;
    ELSIF v_rank <= CEIL(v_total_workers * 0.50) THEN
      v_wave := 2;
    ELSIF v_worker.distance <= 10 THEN
      v_wave := 3;
    ELSE
      v_wave := 4;
    END IF;

    v_results := jsonb_set(
      v_results,
      ARRAY[v_worker.worker_id],
      jsonb_build_object('wave', v_wave, 'score', ROUND(v_worker.score, 3))
    );
  END LOOP;

  -- ─── Persistir resultado con metadata de fallback ──────────────
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


-- ═══════════════════════════════════════════════════════════════
-- 3. RPC pública para leer/escribir flag beta_mode (solo admin)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_app_config(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo el administrador puede modificar la configuración.';
  END IF;

  INSERT INTO app_config (key, value)
  VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION set_app_config(TEXT, TEXT) TO authenticated;

-- Notificar a PostgREST para que recargue el schema
NOTIFY pgrst, 'reload schema';
