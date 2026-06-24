-- CHAMBA 065 — Flujo Estricto de 3 Pasos (Contraofertas y Congelamiento)
SET statement_timeout = '120s';

-- 1. Ampliar job_assignments para registrar la contraoferta
ALTER TABLE job_assignments
  ADD COLUMN IF NOT EXISTS counter_offer_amount NUMERIC(12,2);

COMMENT ON COLUMN job_assignments.counter_offer_amount IS
  'Si es nulo, el técnico aceptó el precio original. Si tiene valor, es la contraoferta.';

-- 2. Ampliar jobs para registrar el bloqueo
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS locked_with_worker_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN jobs.locked_with_worker_id IS
  'Cuando un técnico postula/contraoferta, el job se bloquea con él hasta que el cliente decida.';

-- 3. Modificar accept_job (Técnico se postula / contraoferta)
DROP FUNCTION IF EXISTS accept_job(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION);
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
  -- Bloqueo transaccional
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajo no encontrado');
  END IF;

  -- Solo puede postular si el trabajo está 'open' y NO ESTÁ BLOQUEADO
  IF v_job.status::text <> 'open' OR v_job.locked_with_worker_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya está en negociación con otro técnico o cerrada.');
  END IF;

  -- Validar técnico
  SELECT * INTO v_profile FROM profiles WHERE id = p_worker_id;
  IF NOT FOUND OR v_profile.role::text <> 'worker' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajador no encontrado');
  END IF;
  IF COALESCE(v_profile.is_approved, FALSE) = FALSE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tu cuenta aún no está aprobada por el administrador');
  END IF;

  -- Limitar trabajos activos
  v_active := count_worker_active_commitments(p_worker_id);
  IF v_active >= v_max_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya tenés 2 chambas activas (en curso o negociando). Finalizá o resolvé una para aplicar a otra.',
      'code', 'worker_active_limit'
    );
  END IF;

  -- Validar que no haya postulado antes
  IF EXISTS (
    SELECT 1 FROM job_assignments
    WHERE job_id = p_job_id AND worker_id = p_worker_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya enviaste una oferta a este trabajo.');
  END IF;

  -- Coordenadas
  v_lat := CASE
    WHEN p_applicant_lat IS NOT NULL AND (ABS(p_applicant_lat) > 0.0001 OR ABS(COALESCE(p_applicant_lng, 0)) > 0.0001) THEN p_applicant_lat
    ELSE NULL END;
  v_lng := CASE
    WHEN p_applicant_lng IS NOT NULL AND (ABS(COALESCE(p_applicant_lat, 0)) > 0.0001 OR ABS(p_applicant_lng) > 0.0001) THEN p_applicant_lng
    ELSE NULL END;

  -- Determinar nuevo estado (Congelamiento)
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

  -- Congelar el trabajo
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
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud está siendo modificada en este momento. Intentá de nuevo.');
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya postulaste a este trabajo.');
END;
$$;


-- 4. Modificar client_approve_worker_application (Cliente cierra el trato)
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
  v_assignment job_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.created_by <> p_client_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  -- Solo puede aprobar si está en negociación (congelada) o si por alguna razón sigue open (retrocompatibilidad)
  IF v_job.status::text NOT IN ('open', 'pending_bidding', 'counter_offered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya está cerrada o en progreso');
  END IF;

  SELECT * INTO v_assignment
  FROM job_assignments
  WHERE job_id = p_job_id AND worker_id = p_worker_id AND selection_status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'La postulación no existe o ya no está pendiente');
  END IF;

  -- Actualizar assignments (Aprobar el elegido, rechazar cualquier otro si los hubiera)
  UPDATE job_assignments SET selection_status = 'approved' WHERE id = v_assignment.id;
  UPDATE job_assignments SET selection_status = 'rejected' 
    WHERE job_id = p_job_id AND selection_status = 'pending' AND worker_id <> p_worker_id;

  -- Si hubo contraoferta, actualizamos el pay_amount del job
  IF v_assignment.counter_offer_amount IS NOT NULL THEN
    -- Actualizar el precio final del trabajo para que cuadre con la contraoferta
    UPDATE jobs SET pay_amount = v_assignment.counter_offer_amount WHERE id = p_job_id;
  END IF;

  -- Cerrar el trato y asignar
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
    'assignment_id', v_assignment.id,
    'worker_id', p_worker_id
  );
END;
$$;


-- 5. Modificar client_reject_worker_application (Cliente rechaza, vuelve al pool)
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
  v_updated INT;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.created_by <> p_client_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_job.status::text NOT IN ('open', 'pending_bidding', 'counter_offered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya está cerrada o asignada');
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

  -- Volver al Pool: Si este era el técnico que la tenía congelada, desbloqueamos la solicitud
  IF v_job.locked_with_worker_id = p_worker_id THEN
    UPDATE jobs 
    SET status = 'open',
        locked_with_worker_id = NULL,
        updated_at = NOW()
    WHERE id = p_job_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- 6. Modificar get_job_worker_applications para exponer la contraoferta
CREATE OR REPLACE FUNCTION get_job_worker_applications(
  p_job_id    UUID,
  p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_client profiles%ROWTYPE;
  v_rows JSONB;
  v_owns BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
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
          AND regexp_replace(owner.phone, '\D', '', 'g') = regexp_replace(v_client.phone, '\D', '', 'g')
      ) INTO v_owns;
    END IF;
  END IF;

  IF NOT v_owns THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      ja.id AS assignment_id,
      ja.job_id,
      ja.worker_id,
      ja.assigned_at,
      ja.selection_status,
      ja.counter_offer_amount,
      p.full_name,
      p.avatar_url,
      p.phone,
      p.category_1,
      p.category_2,
      wp.rating_avg,
      wp.total_reviews,
      COALESCE(wp.total_jobs_done, 0) AS total_jobs_done,
      NULLIF(TRIM(wp.bio), '') AS bio,
      ja.applicant_lat AS worker_lat,
      ja.applicant_lng AS worker_lng,
      ROUND(
        fn_haversine_km(v_job.lat, v_job.lng, ja.applicant_lat, ja.applicant_lng)::numeric,
        1
      ) AS distance_km
    FROM job_assignments ja
    JOIN profiles p ON p.id = ja.worker_id
    LEFT JOIN worker_profiles wp ON wp.worker_id = ja.worker_id
    WHERE ja.job_id = p_job_id
      AND ja.selection_status IN ('pending', 'approved', 'rejected')
    ORDER BY
      CASE ja.selection_status
        WHEN 'pending' THEN 0
        WHEN 'approved' THEN 1
        ELSE 2
      END,
      ja.assigned_at ASC
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'job_status', v_job.status::text,
    'locked_with_worker_id', v_job.locked_with_worker_id,
    'applications', v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_job(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC) TO authenticated, anon;
