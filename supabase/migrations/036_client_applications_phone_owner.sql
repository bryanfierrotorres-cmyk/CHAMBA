-- CHAMBA 036 — Cliente ve postulaciones aunque profile.id ≠ created_by (mismo teléfono)
SET statement_timeout = '60s';

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
          AND regexp_replace(owner.phone, '\D', '', 'g')
            = regexp_replace(v_client.phone, '\D', '', 'g')
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
      p.full_name,
      p.avatar_url,
      p.phone,
      p.category_1,
      p.category_2,
      wp.rating_avg,
      wp.total_reviews,
      COALESCE(wp.total_jobs_done, 0) AS total_jobs_done
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

GRANT EXECUTE ON FUNCTION get_job_worker_applications(UUID, UUID) TO authenticated, anon;
