-- CHAMBA 040 — Índices B-Tree para feed, asignaciones y chat (acelera consultas con RLS)
SET statement_timeout = '120s';

-- ── jobs: filtros por estado, cliente y feed ordenado ───────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_status
  ON jobs (status);

CREATE INDEX IF NOT EXISTS idx_jobs_created_by
  ON jobs (created_by);

CREATE INDEX IF NOT EXISTS idx_jobs_created_by_status
  ON jobs (created_by, status);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at
  ON jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_worker_id
  ON jobs (assigned_worker_id)
  WHERE assigned_worker_id IS NOT NULL;

-- ── job_assignments: postulaciones y agenda del técnico ─────────────────────
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id
  ON job_assignments (job_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_id
  ON job_assignments (worker_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_job
  ON job_assignments (worker_id, job_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_job_selection
  ON job_assignments (job_id, selection_status);

-- ── mensajes: chat por servicio (servicio_id = jobs.id) ───────────────────
-- Nota: columna real es servicio_id (no job_id). Índice compuesto ya en 023/039.
CREATE INDEX IF NOT EXISTS idx_mensajes_servicio_id
  ON mensajes (servicio_id);

CREATE INDEX IF NOT EXISTS idx_mensajes_creado_al
  ON mensajes (creado_al DESC);

-- ── profiles: login por teléfono (id ya es PK) ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_phone
  ON profiles (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role_approved
  ON profiles (role, is_approved);
