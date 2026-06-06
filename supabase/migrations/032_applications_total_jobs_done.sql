-- Expone total_jobs_done en postulaciones visibles al cliente.
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
