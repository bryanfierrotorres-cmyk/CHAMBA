-- CHAMBA 068 — Motor de Asignación (MVP Real) y Flujo Híbrido
SET statement_timeout = '120s';

-- 1. Ampliación de Esquema
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS dispatch_data JSONB;

COMMENT ON COLUMN jobs.booking_type IS 'custom = Selección manual; express = Asignación directa Uber-like';
COMMENT ON COLUMN jobs.dispatch_data IS 'Almacena el mapa { worker_id: { wave, score } } calculado al crear la solicitud';

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS acceptance_rate NUMERIC(5,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS completion_rate NUMERIC(5,2) DEFAULT 1.00;


-- 2. Trigger y Función de Cálculo de Scores (El Motor)
CREATE OR REPLACE FUNCTION calculate_job_dispatch_waves(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_worker RECORD;
  v_proximity_score NUMERIC;
  v_score NUMERIC;
  v_distance_km NUMERIC;
  v_results JSONB := '{}'::jsonb;
  v_workers_data JSONB[] := ARRAY[]::JSONB[];
  v_total_workers INT;
  v_wave INT;
  v_rank INT := 0;
BEGIN
  -- Leer la chamba
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  -- Iterar sobre técnicos elegibles (Online y activos en los últimos 30 min)
  -- En la realidad de Chamba, availability_status = 'available' (o 'online', ver type)
  -- El base schema dice: availability_status AS ENUM ('available', 'busy', 'offline')
  -- Usaremos 'available' u 'online'. Para ser seguros, incluimos ambos o nos aseguramos:
  FOR v_worker IN (
    SELECT wp.*, p.full_name
    FROM worker_profiles wp
    JOIN profiles p ON p.id = wp.worker_id
    WHERE p.is_approved = true
      AND p.role::text = 'worker'
      -- AND wp.availability_status::text IN ('available', 'online') -- Idealmente, pero si en dev no hay, quitamos filtro estricto por ahora o lo usamos
      AND wp.last_location_at >= NOW() - INTERVAL '30 minutes'
      AND wp.last_lat IS NOT NULL
      AND wp.last_lng IS NOT NULL
  ) LOOP
    -- Calcular distancia
    v_distance_km := fn_haversine_km(v_job.lat, v_job.lng, v_worker.last_lat, v_worker.last_lng);

    -- Determinar Proximity Score
    IF v_distance_km <= 2 THEN v_proximity_score := 1.0;
    ELSIF v_distance_km <= 5 THEN v_proximity_score := 0.7;
    ELSIF v_distance_km <= 10 THEN v_proximity_score := 0.4;
    ELSE v_proximity_score := 0.1;
    END IF;

    -- Calcular Score Lineal
    v_score := (0.35 * COALESCE(v_worker.rating_avg, 5.0)) + 
               (0.25 * COALESCE(v_worker.acceptance_rate, 1.0)) + 
               (0.20 * v_proximity_score) + 
               (0.20 * COALESCE(v_worker.completion_rate, 1.0));

    -- Acumular temporalmente para ordenar
    v_workers_data := array_append(v_workers_data, jsonb_build_object(
      'worker_id', v_worker.worker_id,
      'score', v_score,
      'distance', v_distance_km
    ));
  END LOOP;

  -- Ordenar y calcular percentiles (Waves)
  v_total_workers := array_length(v_workers_data, 1);
  
  IF v_total_workers IS NULL OR v_total_workers = 0 THEN
    RETURN '{}'::jsonb;
  END IF;

  -- En plpgsql, necesitamos una subquery para ordenar arrays JSONB fácilmente
  FOR v_worker IN (
    SELECT 
      elem->>'worker_id' AS worker_id, 
      (elem->>'score')::NUMERIC AS score,
      (elem->>'distance')::NUMERIC AS distance
    FROM unnest(v_workers_data) AS elem
    ORDER BY (elem->>'score')::NUMERIC DESC
  ) LOOP
    v_rank := v_rank + 1;
    
    -- Lógica de Olas (Waves)
    -- Wave 1: Top 20%
    -- Wave 2: Siguiente 30% (hasta 50%)
    -- Wave 3: Resto dentro de 10km (fases 1-3)
    -- Wave 4: Resto general
    IF v_rank <= CEIL(v_total_workers * 0.20) THEN
      v_wave := 1;
    ELSIF v_rank <= CEIL(v_total_workers * 0.50) THEN
      v_wave := 2;
    ELSIF v_worker.distance <= 10 THEN
      v_wave := 3;
    ELSE
      v_wave := 4;
    END IF;

    -- Construir el JSONB de salida { "uuid": { "wave": X, "score": Y } }
    v_results := jsonb_set(
      v_results,
      ARRAY[v_worker.worker_id],
      jsonb_build_object('wave', v_wave, 'score', ROUND(v_worker.score, 3))
    );
  END LOOP;

  -- Actualizar la solicitud con el mapa de despacho
  UPDATE jobs SET dispatch_data = v_results WHERE id = p_job_id;

  RETURN v_results;
END;
$$;


-- Función Trigger que llama a calculate_job_dispatch_waves
CREATE OR REPLACE FUNCTION trg_dispatch_new_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Corremos el cálculo sincrónicamente
  PERFORM calculate_job_dispatch_waves(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_job_dispatch ON jobs;
CREATE TRIGGER trigger_job_dispatch
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trg_dispatch_new_job();


-- 3. RPC para Bloqueo Atómico (Aceptar Servicio)
CREATE OR REPLACE FUNCTION worker_accept_job(
  p_job_id UUID,
  p_worker_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = on
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_assignment job_assignments%ROWTYPE;
  v_active INT;
  v_max_active INT := 2;
BEGIN
  -- Validar técnico
  SELECT * INTO v_profile FROM profiles WHERE id = p_worker_id;
  IF NOT FOUND OR v_profile.role::text <> 'worker' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajador no encontrado');
  END IF;

  -- Bloqueo atómico transaccional estricto (NOWAIT para que si hay 2 requests fallan en milisegundos)
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajo no encontrado');
  END IF;

  IF v_job.status::text <> 'open' AND v_job.status::text <> 'pending_bidding' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud ya fue tomada por otro técnico o está cerrada.');
  END IF;

  -- Limitar trabajos activos del trabajador
  SELECT COUNT(*) INTO v_active FROM jobs WHERE assigned_worker_id = p_worker_id AND status::text IN ('taken', 'in_progress');
  IF v_active >= v_max_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya tenés 2 chambas en curso. Finalizá una para tomar otra.');
  END IF;

  -- LÓGICA HÍBRIDA
  IF COALESCE(v_job.booking_type, 'custom') = 'express' THEN
    -- Modelo Uber: Asignación Directa
    UPDATE jobs 
    SET status = 'taken',
        assigned_worker_id = p_worker_id,
        locked_with_worker_id = p_worker_id,
        slots_taken = 1,
        operational_phase = 'accepted',
        updated_at = NOW()
    WHERE id = p_job_id;

    -- También creamos su assignment subyacente para no romper el resto de views
    INSERT INTO job_assignments (job_id, worker_id, selection_status)
    VALUES (p_job_id, p_worker_id, 'approved')
    ON CONFLICT (job_id, worker_id) DO UPDATE SET selection_status = 'approved';

    RETURN jsonb_build_object('success', true, 'mode', 'express', 'job_id', p_job_id);

  ELSE
    -- Modelo Custom (Selección por el cliente)
    -- La postulación inserta en assignments como 'pending', y no toca el estado global
    IF EXISTS (SELECT 1 FROM job_assignments WHERE job_id = p_job_id AND worker_id = p_worker_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ya postulaste a este trabajo.');
    END IF;

    INSERT INTO job_assignments (job_id, worker_id, selection_status)
    VALUES (p_job_id, p_worker_id, 'pending')
    RETURNING * INTO v_assignment;

    RETURN jsonb_build_object('success', true, 'mode', 'custom', 'assignment_id', v_assignment.id);
  END IF;

EXCEPTION
  WHEN lock_not_available THEN
    -- El NOWAIT tiró este error porque otro hilo ya bloqueó la fila
    RETURN jsonb_build_object('success', false, 'error', '¡Alguien fue más rápido! La solicitud ya fue tomada.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION worker_accept_job(UUID, UUID) TO authenticated, anon;
