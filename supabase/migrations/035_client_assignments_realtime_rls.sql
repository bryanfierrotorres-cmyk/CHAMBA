-- CHAMBA 035 — Cliente ve postulaciones en Realtime (RLS SELECT en job_assignments)
SET statement_timeout = '60s';

DROP POLICY IF EXISTS "assignments: client select own jobs" ON job_assignments;
CREATE POLICY "assignments: client select own jobs"
  ON job_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_assignments.job_id
        AND j.created_by = auth.uid()
    )
  );

-- Lectura anónima piloto (login teléfono sin JWT) — ya existía; asegurar que siga activa
DROP POLICY IF EXISTS "pilot_anon_assignments_select" ON job_assignments;
CREATE POLICY "pilot_anon_assignments_select"
  ON job_assignments FOR SELECT
  TO anon
  USING (true);
