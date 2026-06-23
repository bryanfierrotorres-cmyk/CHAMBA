-- CHAMBA — Esquema base completo para proyecto nuevo
-- Ejecuta este bloque PRIMERO en Supabase SQL Editor del nuevo proyecto
-- Crea todas las tablas, tipos y funciones base que las migraciones asumen

SET statement_timeout = '300s';

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════
-- 1. TIPOS ENUM
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'worker', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('open', 'taken', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE worker_operational_phase AS ENUM ('accepted', 'en_route', 'arrived', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE availability_status AS ENUM ('available', 'busy', 'offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_application_selection_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status_enum AS ENUM ('pending', 'processing', 'paid', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════
-- 2. TABLA profiles
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT DEFAULT '',
  full_name         TEXT NOT NULL DEFAULT '',
  phone             TEXT,
  avatar_url        TEXT,
  role              user_role NOT NULL DEFAULT 'worker',
  is_approved       BOOLEAN NOT NULL DEFAULT FALSE,
  worker_status     TEXT,
  cedula_url        TEXT,
  record_policia_url TEXT,
  category_1        TEXT,
  category_2        TEXT,
  category_1_approved BOOLEAN NOT NULL DEFAULT FALSE,
  category_2_approved BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_account_id TEXT,
  fcm_token         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 3. TABLA worker_profiles
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS worker_profiles (
  worker_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  bio               TEXT,
  skills            TEXT[] DEFAULT '{}',
  id_document_url   TEXT,
  id_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  rating_avg        NUMERIC(3,2),
  total_reviews     INTEGER NOT NULL DEFAULT 0,
  total_jobs_done   INTEGER NOT NULL DEFAULT 0,
  availability_status availability_status NOT NULL DEFAULT 'offline',
  last_lat          DOUBLE PRECISION,
  last_lng          DOUBLE PRECISION,
  last_location_at  TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 4. TABLA jobs
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  category          TEXT,
  status            TEXT NOT NULL DEFAULT 'open',
  operational_phase TEXT,
  pay_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
  worker_payout     NUMERIC(12,2) NOT NULL DEFAULT 0,
  address           TEXT NOT NULL DEFAULT '',
  lat               DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng               DOUBLE PRECISION NOT NULL DEFAULT 0,
  scheduled_at      TIMESTAMPTZ,
  scheduled_date    TEXT,
  scheduled_time    TEXT,
  urgency_level     TEXT DEFAULT 'hoy',
  duration_hours    NUMERIC NOT NULL DEFAULT 1,
  required_workers  INTEGER NOT NULL DEFAULT 1,
  slots_taken       INTEGER NOT NULL DEFAULT 0,
  media_urls        TEXT[] DEFAULT '{}',
  before_photo_url  TEXT,
  after_photo_url   TEXT,
  assigned_worker_id UUID,
  created_by        UUID NOT NULL,
  moderated_by      UUID,
  moderation_reason TEXT,
  moderated_at      TIMESTAMPTZ,
  rejection_note    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 5. TABLA job_assignments
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS job_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL,
  worker_id         UUID NOT NULL,
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  payment_status    TEXT NOT NULL DEFAULT 'pending',
  payment_intent_id TEXT,
  selection_status  TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (job_id, worker_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 6. TABLA mensajes (chat)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mensajes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id       UUID NOT NULL,
  remitente_id      UUID NOT NULL,
  texto             TEXT NOT NULL DEFAULT '',
  creado_al         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 7. TABLA notifications
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'job_update',
  data              JSONB DEFAULT '{}',
  read              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 8. TABLA home_banners
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS home_banners (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL DEFAULT '',
  subtitle          TEXT DEFAULT '',
  image_url         TEXT,
  action_url        TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 9. TABLA precios_catalogo
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS precios_catalogo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id   UUID,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  suggested_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 10. ÍNDICES BASE
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_status_category_created_at ON jobs(status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_open_radar ON jobs(created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker ON job_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_selection ON job_assignments(worker_id, selection_status, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_servicio ON mensajes(servicio_id, creado_al ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_availability ON worker_profiles(availability_status) WHERE availability_status = 'available';

-- ═══════════════════════════════════════════════════════════════
-- 11. RLS BASE
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_catalogo ENABLE ROW LEVEL SECURITY;

-- Profiles: público leer, propio escribir
DROP POLICY IF EXISTS "profiles: public read" ON profiles;
CREATE POLICY "profiles: public read" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles: owner upsert" ON profiles;
CREATE POLICY "profiles: owner upsert" ON profiles FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Jobs: propios ver/crear
DROP POLICY IF EXISTS "jobs: select own or public" ON jobs;
CREATE POLICY "jobs: select own or public" ON jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "jobs: insert own" ON jobs;
CREATE POLICY "jobs: insert own" ON jobs FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "jobs: update involved" ON jobs;
CREATE POLICY "jobs: update involved" ON jobs FOR UPDATE USING (created_by = auth.uid() OR assigned_worker_id = auth.uid());

-- Assignments: propios ver/crear
DROP POLICY IF EXISTS "assignments: select own" ON job_assignments;
CREATE POLICY "assignments: select own" ON job_assignments FOR SELECT USING (worker_id = auth.uid() OR EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_assignments.job_id AND jobs.created_by = auth.uid()));

DROP POLICY IF EXISTS "assignments: insert own" ON job_assignments;
CREATE POLICY "assignments: insert own" ON job_assignments FOR INSERT WITH CHECK (worker_id = auth.uid());

-- Notificaciones: propias
DROP POLICY IF EXISTS "notifications: select own" ON notifications;
CREATE POLICY "notifications: select own" ON notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications: insert system" ON notifications;
CREATE POLICY "notifications: insert system" ON notifications FOR INSERT WITH CHECK (true);

-- Mensajes: participantes
DROP POLICY IF EXISTS "mensajes: select participants" ON mensajes;
CREATE POLICY "mensajes: select participants" ON mensajes FOR SELECT USING (remitente_id = auth.uid() OR servicio_id IN (SELECT id FROM jobs WHERE created_by = auth.uid() OR assigned_worker_id = auth.uid()));

DROP POLICY IF EXISTS "mensajes: insert participant" ON mensajes;
CREATE POLICY "mensajes: insert participant" ON mensajes FOR INSERT WITH CHECK (remitente_id = auth.uid());

-- Home banners: público leer
DROP POLICY IF EXISTS "banners: public read" ON home_banners;
CREATE POLICY "banners: public read" ON home_banners FOR SELECT USING (is_active = TRUE);

-- Precios: público leer
DROP POLICY IF EXISTS "precios: public read" ON precios_catalogo;
CREATE POLICY "precios: public read" ON precios_catalogo FOR SELECT USING (is_active = TRUE);

-- ═══════════════════════════════════════════════════════════════
-- 12. RPCs BASE
-- ═══════════════════════════════════════════════════════════════

-- RPC: perfil por teléfono (login OTP)
CREATE OR REPLACE FUNCTION get_profile_by_phone(p_phone TEXT)
RETURNS SETOF profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM profiles WHERE phone = p_phone OR phone = regexp_replace(p_phone, '[^0-9]', '', 'g') LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION get_profile_by_phone TO anon, authenticated;

-- RPC: feed de jobs para worker
CREATE OR REPLACE FUNCTION get_worker_open_jobs_feed(
  p_worker_id UUID,
  p_status TEXT DEFAULT 'open',
  p_categories TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jobs JSONB;
  v_count INTEGER;
BEGIN
  SELECT jsonb_agg(j), count(*) INTO v_jobs, v_count
  FROM (
    SELECT jobs.* FROM jobs
    WHERE jobs.status = p_status
      AND (p_categories IS NULL OR jobs.category = ANY(p_categories))
    ORDER BY jobs.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) j;
  RETURN jsonb_build_object('success', true, 'jobs', COALESCE(v_jobs, '[]'::jsonb), 'count', COALESCE(v_count, 0));
END;
$$;
GRANT EXECUTE ON FUNCTION get_worker_open_jobs_feed TO anon, authenticated;

-- RPC: feed público de jobs
CREATE OR REPLACE FUNCTION get_open_jobs_feed(
  p_status TEXT DEFAULT 'open',
  p_categories TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jobs JSONB;
  v_count INTEGER;
BEGIN
  SELECT jsonb_agg(j), count(*) INTO v_jobs, v_count
  FROM (
    SELECT jobs.* FROM jobs
    WHERE jobs.status = p_status
      AND (p_categories IS NULL OR jobs.category = ANY(p_categories))
    ORDER BY jobs.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) j;
  RETURN jsonb_build_object('success', true, 'jobs', COALESCE(v_jobs, '[]'::jsonb), 'count', COALESCE(v_count, 0));
END;
$$;
GRANT EXECUTE ON FUNCTION get_open_jobs_feed TO anon, authenticated;

-- RPC: contar jobs activos del cliente
CREATE OR REPLACE FUNCTION count_client_active_jobs(p_client_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM jobs
  WHERE created_by = p_client_id AND status IN ('open', 'taken', 'in_progress');
$$;
GRANT EXECUTE ON FUNCTION count_client_active_jobs TO anon, authenticated;

-- RPC: contar commitments activos del worker
CREATE OR REPLACE FUNCTION count_worker_active_commitments(p_worker_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::INTEGER FROM job_assignments ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.worker_id = p_worker_id AND j.status IN ('open', 'taken', 'in_progress');
$$;
GRANT EXECUTE ON FUNCTION count_worker_active_commitments TO anon, authenticated;

-- RPC: avanzar fase operativa
CREATE OR REPLACE FUNCTION worker_advance_operational_phase(
  p_job_id UUID,
  p_worker_id UUID,
  p_phase TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  v_status := CASE p_phase
    WHEN 'accepted' THEN 'taken'
    WHEN 'en_route' THEN 'in_progress'
    WHEN 'arrived' THEN 'in_progress'
    WHEN 'completed' THEN 'completed'
    ELSE 'in_progress'
  END;
  UPDATE jobs SET operational_phase = p_phase::worker_operational_phase, status = v_status, updated_at = NOW()
  WHERE id = p_job_id AND (assigned_worker_id = p_worker_id OR EXISTS (SELECT 1 FROM job_assignments WHERE job_id = p_job_id AND worker_id = p_worker_id));
  IF FOUND THEN
    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos o job no encontrado');
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION worker_advance_operational_phase TO anon, authenticated;

-- RPC: aceptar trabajo
CREATE OR REPLACE FUNCTION accept_job(
  p_job_id UUID,
  p_worker_id UUID,
  p_applicant_lat DOUBLE PRECISION DEFAULT NULL,
  p_applicant_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_assignment_id UUID;
  v_selection_status TEXT := 'pending';
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;
  IF v_job.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud ya tomada');
  END IF;
  IF EXISTS (SELECT 1 FROM job_assignments WHERE job_id = p_job_id AND worker_id = p_worker_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya postulaste anteriormente');
  END IF;
  INSERT INTO job_assignments (job_id, worker_id, selection_status)
  VALUES (p_job_id, p_worker_id, v_selection_status)
  RETURNING id INTO v_assignment_id;
  RETURN jsonb_build_object('success', true, 'assignment_id', v_assignment_id, 'selection_status', v_selection_status);
END;
$$;
GRANT EXECUTE ON FUNCTION accept_job TO anon, authenticated;

-- RPC: agenda del worker
CREATE OR REPLACE FUNCTION get_worker_agenda_panel(p_worker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', ja.id,
    'job_id', ja.job_id,
    'worker_id', ja.worker_id,
    'assigned_at', ja.assigned_at,
    'completed_at', ja.completed_at,
    'payment_status', ja.payment_status,
    'selection_status', ja.selection_status,
    'job', to_jsonb(j.*)
  )) INTO v_result
  FROM job_assignments ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE ja.worker_id = p_worker_id
  ORDER BY ja.assigned_at DESC;
  RETURN jsonb_build_object('success', true, 'assignments', COALESCE(v_result, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION get_worker_agenda_panel TO anon, authenticated;

-- RPC: panel de órdenes del cliente
CREATE OR REPLACE FUNCTION get_client_orders_panel(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(to_jsonb(j.*)) INTO v_result
  FROM jobs j
  WHERE j.created_by = p_client_id
  ORDER BY j.created_at DESC;
  RETURN jsonb_build_object('success', true, 'jobs', COALESCE(v_result, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION get_client_orders_panel TO anon, authenticated;

-- Asegurar auth.phone para login OTP
CREATE OR REPLACE FUNCTION ensure_phone_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;
GRANT EXECUTE ON FUNCTION ensure_phone_auth_user TO authenticated;

-- RPC bootstrap catálogo
CREATE OR REPLACE FUNCTION ensure_bootstrap_catalog()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO service_categories (slug, name, icon, sort_order) VALUES
    ('limpieza', 'Limpieza', '🧹', 1),
    ('vehiculos', 'Vehículos', '🚗', 2),
    ('jardineria', 'Jardinería', '🌿', 3),
    ('conserjeria', 'Conserjería', '🏠', 4),
    ('fumigacion', 'Fumigación', '🪲', 5)
  ON CONFLICT (slug) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION ensure_bootstrap_catalog TO authenticated;

-- RPC: worker complete job
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
DECLARE v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_assignments WHERE id = p_assignment_id AND job_id = p_job_id AND worker_id = p_worker_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asignación inválida');
  END IF;
  UPDATE jobs SET status = 'completed', operational_phase = 'completed'::worker_operational_phase, updated_at = v_now WHERE id = p_job_id;
  UPDATE job_assignments SET completed_at = v_now WHERE id = p_assignment_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION worker_complete_job(UUID, UUID, UUID) TO anon, authenticated;

-- RPC: worker start job
CREATE OR REPLACE FUNCTION worker_start_job(p_job_id UUID, p_worker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_assignments WHERE job_id = p_job_id AND worker_id = p_worker_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin asignación');
  END IF;
  UPDATE jobs SET status = 'in_progress', updated_at = NOW() WHERE id = p_job_id AND status IN ('open', 'taken');
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION worker_start_job(UUID, UUID) TO anon, authenticated;

-- RPC: boost job offer
CREATE OR REPLACE FUNCTION boost_client_job_offer(
  p_job_id UUID,
  p_client_id UUID,
  p_pay_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_job jobs%ROWTYPE;
BEGIN
  UPDATE jobs SET pay_amount = p_pay_amount, created_at = NOW(), updated_at = NOW()
  WHERE id = p_job_id AND created_by = p_client_id AND status = 'open'
  RETURNING * INTO v_job;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'job', to_jsonb(v_job));
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada o no activa');
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION boost_client_job_offer(UUID, UUID, NUMERIC) TO anon, authenticated;

-- RPC: admin get job applications
CREATE OR REPLACE FUNCTION get_job_worker_applications(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'assignment_id', ja.id,
    'job_id', ja.job_id,
    'worker_id', ja.worker_id,
    'assigned_at', ja.assigned_at,
    'selection_status', ja.selection_status,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'phone', p.phone,
    'category_1', p.category_1,
    'category_2', p.category_2,
    'rating_avg', wp.rating_avg,
    'total_reviews', wp.total_reviews,
    'total_jobs_done', wp.total_jobs_done,
    'bio', wp.bio,
    'worker_lat', wp.last_lat,
    'worker_lng', wp.last_lng
  ) ORDER BY ja.assigned_at ASC) INTO v_result
  FROM job_assignments ja
  JOIN profiles p ON p.id = ja.worker_id
  LEFT JOIN worker_profiles wp ON wp.worker_id = ja.worker_id
  WHERE ja.job_id = p_job_id;
  RETURN jsonb_build_object('success', true, 'applications', COALESCE(v_result, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION get_job_worker_applications(UUID) TO anon, authenticated;

-- RPC: advance complete assignment
CREATE OR REPLACE FUNCTION advance_complete_assignment(
  p_job_id UUID,
  p_worker_id UUID,
  p_assignment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_now TIMESTAMPTZ := NOW();
BEGIN
  UPDATE job_assignments SET completed_at = v_now WHERE id = p_assignment_id AND worker_id = p_worker_id;
  UPDATE jobs SET status = 'completed', operational_phase = 'completed'::worker_operational_phase, updated_at = v_now
  WHERE id = p_job_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION advance_complete_assignment(UUID, UUID, UUID) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 13. REALTIME
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'job_assignments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE job_assignments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mensajes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'worker_profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE worker_profiles;
  END IF;
END$$;

-- ═══════════════════════════════════════════════════════════════
-- 14. TRIGGER updated_at
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_worker_profiles_updated_at ON worker_profiles;
CREATE TRIGGER update_worker_profiles_updated_at BEFORE UPDATE ON worker_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers para tablas que se crean en migraciones posteriores
-- Se aplican con DO blocks para evitar errores si la tabla aún no existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_categories') THEN
    DROP TRIGGER IF EXISTS update_service_categories_updated_at ON service_categories;
    CREATE TRIGGER update_service_categories_updated_at BEFORE UPDATE ON service_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_types') THEN
    DROP TRIGGER IF EXISTS update_service_types_updated_at ON service_types;
    CREATE TRIGGER update_service_types_updated_at BEFORE UPDATE ON service_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'precios_catalogo') THEN
    DROP TRIGGER IF EXISTS update_precios_catalogo_updated_at ON precios_catalogo;
    CREATE TRIGGER update_precios_catalogo_updated_at BEFORE UPDATE ON precios_catalogo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'home_banners') THEN
    DROP TRIGGER IF EXISTS update_home_banners_updated_at ON home_banners;
    CREATE TRIGGER update_home_banners_updated_at BEFORE UPDATE ON home_banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;
