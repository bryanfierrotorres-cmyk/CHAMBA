-- CHAMBA 050 — Al finalizar, sincronizar operational_phase y corregir historial técnico

CREATE OR REPLACE FUNCTION worker_complete_job(
  p_job_id UUID,
  p_worker_id UUID,
  p_assignment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM job_assignments
     WHERE id = p_assignment_id AND job_id = p_job_id AND worker_id = p_worker_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asignación inválida');
  END IF;

  UPDATE jobs
     SET status = 'completed'::job_status,
         operational_phase = 'completed',
         updated_at = v_now
   WHERE id = p_job_id;

  UPDATE job_assignments
     SET completed_at = v_now
   WHERE id = p_assignment_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION worker_complete_job(UUID, UUID, UUID)
  TO anon, authenticated;

-- Chambas ya marcadas completed sin fase terminal
UPDATE jobs
   SET operational_phase = 'completed'
 WHERE status = 'completed'::job_status
   AND COALESCE(operational_phase, '') <> 'completed';

NOTIFY pgrst, 'reload schema';
