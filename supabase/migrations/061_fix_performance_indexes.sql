-- CHAMBA 061 — Performance indexes for 50 concurrent users
-- Índices faltantes para queries de alto tráfico

SET statement_timeout = '120s';

-- Feed de jobs: filtrado por status + categoría + orden
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_category_created_at
  ON jobs (status, category, created_at DESC);

-- Radar de workers: jobs abiertos ordenados por fecha (con expiry)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_open_radar
  ON jobs (created_at DESC)
  WHERE status = 'open';

-- Agenda de worker: lookup por worker + selection_status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_assignments_worker_selection
  ON job_assignments (worker_id, selection_status, assigned_at DESC);

-- Chat: lookup de mensajes por servicio
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mensajes_servicio_creado
  ON mensajes (servicio_id, creado_al ASC);

-- Notificaciones: fetch por usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read, created_at DESC);

-- Worker profiles: lookup por disponibilidad (para notify-new-job)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_profiles_available
  ON worker_profiles (availability_status)
  WHERE availability_status = 'available';

-- Profiles: lookup por rol + aprobado (para admin panel)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role_approved
  ON profiles (role, is_approved);

-- Jobs: lookup por created_by + status (para dashboard admin)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_created_by_status
  ON jobs (created_by, status);
