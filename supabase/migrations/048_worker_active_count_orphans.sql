-- CHAMBA 048 — Cupo técnico: excluir asignaciones huérfanas / no asignadas al worker
SET statement_timeout = '60s';

CREATE OR REPLACE FUNCTION count_worker_active_commitments(
  p_worker_id UUID,
  p_exclude_job_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT j.id)::INT
  FROM job_assignments ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.worker_id = p_worker_id
    AND j.status::text NOT IN ('completed', 'cancelled')
    AND (p_exclude_job_id IS NULL OR j.id IS DISTINCT FROM p_exclude_job_id)
    AND ja.selection_status IS DISTINCT FROM 'rejected'
    AND (
      (
        j.status::text = 'open'
        AND ja.selection_status = 'pending'
        AND (j.assigned_worker_id IS NULL OR j.assigned_worker_id = p_worker_id)
      )
      OR (
        j.status::text = 'in_progress'
        AND ja.selection_status = 'approved'
        AND j.assigned_worker_id = p_worker_id
      )
      OR (
        j.status::text = 'taken'
        AND ja.selection_status = 'approved'
        AND j.assigned_worker_id = p_worker_id
        AND COALESCE(j.operational_phase, 'accepted') <> 'completed'
      )
    );
$$;

GRANT EXECUTE ON FUNCTION count_worker_active_commitments(UUID, UUID) TO anon, authenticated;
