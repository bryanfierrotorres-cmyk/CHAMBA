-- CHAMBA 069 — Lock Atómico Híbrido en accept_job (Express vs Custom)
SET statement_timeout = '60s';

-- Reemplazar la función original accept_job para inyectar el comportamiento híbrido de booking_type
DROP FUNCTION IF EXISTS accept_job(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC);

CREATE OR REPLACE FUNCTION accept_job(
  p_job_id                 UUID,
  p_worker_id              UUID,
  p_applicant_lat          DOUBLE PRECISION DEFAULT NULL,
  p_applicant_lng          DOUBLE PRECISION DEFAULT NULL,
  p_counter_offer_amount   NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job         jobs%ROWTYPE;
  v_profile     profiles%ROWTYPE;
  v_assignment  job_assignments%ROWTYPE;
  v_active      INT;
  v_max_active  INT := 2;
  v_lat         DOUBLE PRECISION;
  v_lng         DOUBLE PRECISION;
  v_new_status  TEXT;
BEGIN
  -- 1. Validar técnico
  SELECT * INTO v_profile FROM profiles WHERE id = p_worker_id;
  IF NOT FOUND OR v_profile.role::text <> 'worker' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajador no encontrado');
  END IF;
  IF COALESCE(v_profile.is_approved, FALSE) = FALSE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tu cuenta aún no está aprobada por el administrador');
  END IF;

  -- 2. Bloqueo transaccional atómico
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajo no encontrado');
  END IF;

  -- 3. Limitar trabajos activos
  v_active := count_worker_active_commitments(p_worker_id);
  IF v_active >= v_max_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya tenés 2 chambas activas (en curso o negociando). Finalizá o resolvé una para aplicar a otra.',
      'code', 'worker_active_limit'
    );
  END IF;

  -- 4. Validar que no haya postulado antes
  IF EXISTS (
    SELECT 1 FROM job_assignments
    WHERE job_id = p_job_id AND worker_id = p_worker_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya enviaste una oferta o tomaste este trabajo.');
  END IF;

  -- 5. Coordenadas
  v_lat := CASE
    WHEN p_applicant_lat IS NOT NULL AND (ABS(p_applicant_lat) > 0.0001 OR ABS(COALESCE(p_applicant_lng, 0)) > 0.0001) THEN p_applicant_lat
    ELSE NULL END;
  v_lng := CASE
    WHEN p_applicant_lng IS NOT NULL AND (ABS(COALESCE(p_applicant_lat, 0)) > 0.0001 OR ABS(p_applicant_lng) > 0.0001) THEN p_applicant_lng
    ELSE NULL END;

  -- ==========================================
  -- LÓGICA HÍBRIDA POR BOOKING_TYPE
  -- ==========================================
  IF COALESCE(v_job.booking_type, 'custom') = 'express' THEN
    -- Modelo UBER: Asignación Directa
    
    -- Solo puede aceptar si sigue open o pending_bidding (por si acaso el cliente metió precio directo)
    IF v_job.status::text NOT IN ('open', 'pending_bidding') THEN
      RETURN jsonb_build_object('success', false, 'error', '¡Alguien fue más rápido! La solicitud ya fue tomada.');
    END IF;

    -- Tomar la chamba
    UPDATE jobs 
    SET status = 'taken',
        assigned_worker_id = p_worker_id,
        locked_with_worker_id = p_worker_id,
        slots_taken = 1,
        operational_phase = 'accepted',
        updated_at = NOW()
    WHERE id = p_job_id;

    -- Registrar assignment aprobado (para mantener la consistencia con el resto de la app)
    INSERT INTO job_assignments (
      job_id, worker_id, selection_status, applicant_lat, applicant_lng, counter_offer_amount
    ) VALUES (
      p_job_id, p_worker_id, 'approved', v_lat, v_lng, p_counter_offer_amount
    ) RETURNING * INTO v_assignment;

    RETURN jsonb_build_object(
      'success', true,
      'assignment_id', v_assignment.id,
      'selection_status', 'approved',
      'job_id', p_job_id,
      'worker_id', p_worker_id
    );

  ELSE
    -- Modelo CUSTOM: Puja y Selección Manual
    
    -- Solo puede postular si el trabajo está 'open' y NO ESTÁ BLOQUEADO
    IF v_job.status::text <> 'open' OR v_job.locked_with_worker_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya está en negociación con otro técnico o cerrada.');
    END IF;

    -- Determinar nuevo estado (Congelamiento de Puja)
    IF p_counter_offer_amount IS NOT NULL THEN
      v_new_status := 'counter_offered';
    ELSE
      v_new_status := 'pending_bidding';
    END IF;

    -- Registrar postulación
    INSERT INTO job_assignments (
      job_id, worker_id, selection_status, applicant_lat, applicant_lng, counter_offer_amount
    ) VALUES (
      p_job_id, p_worker_id, 'pending', v_lat, v_lng, p_counter_offer_amount
    ) RETURNING * INTO v_assignment;

    -- Congelar el trabajo para este técnico
    UPDATE jobs 
    SET status = v_new_status,
        locked_with_worker_id = p_worker_id,
        updated_at = NOW()
    WHERE id = p_job_id;

    RETURN jsonb_build_object(
      'success', true,
      'assignment_id', v_assignment.id,
      'selection_status', 'pending',
      'job_id', p_job_id,
      'worker_id', p_worker_id
    );

  END IF;

EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', '¡Alguien fue más rápido! La solicitud está siendo modificada en este momento.');
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya enviaste una oferta a este trabajo.');
END;
$$;

-- También nos aseguramos de borrar el worker_accept_job de la migración anterior para no dejar basura
DROP FUNCTION IF EXISTS worker_accept_job(UUID, UUID);
