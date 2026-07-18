-- CHAMBA 083 — Fix client approve/reject logic for bidding phase
SET statement_timeout = '60s';

-- 1. Actualizar client_approve_worker_application
CREATE OR REPLACE FUNCTION client_approve_worker_application(
  p_job_id    UUID,
  p_client_id UUID,
  p_worker_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_client profiles%ROWTYPE;
  v_assignment_id UUID;
  v_active INT;
  v_max_active INT := 2;
  v_owns BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_job.created_by = p_client_id THEN
    v_owns := TRUE;
  ELSE
    SELECT * INTO v_client FROM profiles WHERE id = p_client_id;
    IF FOUND AND v_client.phone IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM profiles owner
        WHERE owner.id = v_job.created_by
          AND owner.phone IS NOT NULL
          AND regexp_replace(owner.phone, '\D', '', 'g')
            = regexp_replace(v_client.phone, '\D', '', 'g')
      ) INTO v_owns;
    END IF;
  END IF;

  IF NOT v_owns THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  -- PERMITIR LOS NUEVOS ESTADOS DE SUBASTA
  IF v_job.status::text NOT IN ('open', 'pending_bidding', 'counter_offered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya fue asignada o no está disponible');
  END IF;

  SELECT id INTO v_assignment_id
  FROM job_assignments
  WHERE job_id = p_job_id
    AND worker_id = p_worker_id
    AND selection_status = 'pending';

  IF v_assignment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este técnico no tiene una postulación activa');
  END IF;

  v_active := count_worker_active_commitments(p_worker_id, p_job_id);
  IF v_active >= v_max_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este técnico ya tiene 2 chambas activas y no puede tomar otra hasta finalizar una.',
      'code', 'worker_active_limit'
    );
  END IF;

  UPDATE job_assignments
  SET selection_status = 'approved'
  WHERE id = v_assignment_id;

  UPDATE job_assignments
  SET selection_status = 'rejected'
  WHERE job_id = p_job_id
    AND selection_status = 'pending'
    AND worker_id <> p_worker_id;

  UPDATE jobs
  SET status = 'taken',
      assigned_worker_id = p_worker_id,
      locked_with_worker_id = p_worker_id,
      slots_taken = 1,
      operational_phase = 'accepted',
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'worker_id', p_worker_id,
    'job_status', 'taken',
    'selection_status', 'approved',
    'operational_phase', 'accepted'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION client_approve_worker_application(UUID, UUID, UUID) TO anon, authenticated;


-- 2. Actualizar client_reject_worker_application
CREATE OR REPLACE FUNCTION client_reject_worker_application(
  p_job_id    UUID,
  p_client_id UUID,
  p_worker_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job     jobs%ROWTYPE;
  v_client profiles%ROWTYPE;
  v_updated INT;
  v_owns BOOLEAN := FALSE;
  v_remaining INT;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_job.created_by = p_client_id THEN
    v_owns := TRUE;
  ELSE
    SELECT * INTO v_client FROM profiles WHERE id = p_client_id;
    IF FOUND AND v_client.phone IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM profiles owner
        WHERE owner.id = v_job.created_by
          AND owner.phone IS NOT NULL
          AND regexp_replace(owner.phone, '\D', '', 'g')
            = regexp_replace(v_client.phone, '\D', '', 'g')
      ) INTO v_owns;
    END IF;
  END IF;

  IF NOT v_owns THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  -- PERMITIR LOS NUEVOS ESTADOS DE SUBASTA
  IF v_job.status::text NOT IN ('open', 'pending_bidding', 'counter_offered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya fue asignada o no está disponible');
  END IF;

  UPDATE job_assignments
  SET selection_status = 'rejected'
  WHERE job_id = p_job_id
    AND worker_id = p_worker_id
    AND selection_status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Postulación no encontrada');
  END IF;

  -- Si se rechazaron todas las postulaciones, el trabajo debería volver a open
  SELECT COUNT(*) INTO v_remaining 
  FROM job_assignments 
  WHERE job_id = p_job_id AND selection_status = 'pending';

  IF v_remaining = 0 AND v_job.status::text <> 'open' THEN
    UPDATE jobs 
    SET status = 'open', 
        locked_with_worker_id = NULL,
        updated_at = NOW() 
    WHERE id = p_job_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION client_reject_worker_application(UUID, UUID, UUID) TO anon, authenticated;
