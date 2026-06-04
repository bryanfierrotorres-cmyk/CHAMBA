-- CHAMBA 016 — Cliente elige técnico entre hasta 3 postulaciones (regla de negocio)
SET statement_timeout = '120s';

ALTER TABLE job_assignments
  ADD COLUMN IF NOT EXISTS selection_status TEXT NOT NULL DEFAULT 'approved';

COMMENT ON COLUMN job_assignments.selection_status IS
  'pending = postuló y espera decisión del cliente; approved = elegido; rejected = no elegido';

-- Asignaciones históricas en trabajos ya cerrados siguen aprobadas
UPDATE job_assignments ja
SET selection_status = 'approved'
FROM jobs j
WHERE ja.job_id = j.id
  AND j.status IN ('taken', 'in_progress', 'completed')
  AND ja.selection_status IS DISTINCT FROM 'approved';

-- ── accept_job: postulación (máx. 3), el job sigue open ───────────────────
CREATE OR REPLACE FUNCTION accept_job(
  p_job_id    UUID,
  p_worker_id UUID
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
  v_pending     INT;
  v_max_apply   INT := 3;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajo no encontrado');
  END IF;

  IF v_job.status::text <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este trabajo ya no acepta postulaciones');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_worker_id;

  IF NOT FOUND OR v_profile.role::text <> 'worker' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trabajador no encontrado');
  END IF;

  IF COALESCE(v_profile.is_approved, FALSE) = FALSE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tu cuenta aún no está aprobada por el administrador');
  END IF;

  IF EXISTS (
    SELECT 1 FROM job_assignments
    WHERE job_id = p_job_id AND worker_id = p_worker_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya postulaste a este trabajo');
  END IF;

  SELECT COUNT(*)::INT INTO v_pending
  FROM job_assignments
  WHERE job_id = p_job_id
    AND selection_status = 'pending';

  IF v_pending >= v_max_apply THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ya hay 3 técnicos postulando. El cliente está eligiendo.'
    );
  END IF;

  INSERT INTO job_assignments (job_id, worker_id, selection_status)
  VALUES (p_job_id, p_worker_id, 'pending')
  RETURNING * INTO v_assignment;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment.id,
    'selection_status', 'pending',
    'pending_count', v_pending + 1,
    'job_id', p_job_id,
    'worker_id', p_worker_id
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Otro técnico está postulando. Intentá de nuevo.');
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya postulaste a este trabajo');
END;
$$;

-- ── Postulaciones visibles para el cliente ─────────────────────────────────
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
  v_rows JSONB;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;

  IF NOT FOUND OR v_job.created_by <> p_client_id THEN
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
      p.full_name,
      p.avatar_url,
      p.phone,
      p.category_1,
      p.category_2,
      wp.rating_avg,
      wp.total_reviews
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
    'applications', v_rows
  );
END;
$$;

-- ── Cliente aprueba un técnico ─────────────────────────────────────────────
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
  v_assignment_id UUID;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;

  IF NOT FOUND OR v_job.created_by <> p_client_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_job.status::text <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya fue asignada');
  END IF;

  SELECT id INTO v_assignment_id
  FROM job_assignments
  WHERE job_id = p_job_id
    AND worker_id = p_worker_id
    AND selection_status = 'pending';

  IF v_assignment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este técnico no tiene una postulación activa');
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
      slots_taken = 1,
      operational_phase = 'accepted',
      updated_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'worker_id', p_worker_id
  );
END;
$$;

-- ── Cliente rechaza una postulación ────────────────────────────────────────
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
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;

  IF NOT FOUND OR v_job.created_by <> p_client_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;

  IF v_job.status::text <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya fue asignada');
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

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_job(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_job_worker_applications(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION client_approve_worker_application(UUID, UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION client_reject_worker_application(UUID, UUID, UUID) TO authenticated, anon;
