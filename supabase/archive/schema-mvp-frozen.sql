-- ⚠️ ARCHIVO CONGELADO — NO EJECUTAR
-- Snapshot del MVP inicial. Esquema actual: supabase/migrations/001–011
-- Ver supabase/README.md
-- ================================================================
--  CHAMBA — Fase 1 · Schema PostgreSQL completo (histórico)
-- ================================================================


-- ================================================================
-- 0. EXTENSIONES
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUIDs v4
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Búsqueda fuzzy en títulos de jobs


-- ================================================================
-- 1. ENUMS
-- ================================================================

CREATE TYPE user_role AS ENUM (
  'admin',
  'worker',
  'client'
);

CREATE TYPE job_status AS ENUM (
  'open',         -- Disponible para ser tomado
  'taken',        -- Todos los slots cubiertos
  'in_progress',  -- Trabajo en curso
  'completed',    -- Finalizado y pagado
  'cancelled'     -- Cancelado por el admin
);

CREATE TYPE job_category AS ENUM (
  'limpieza_sofas',
  'limpieza_alfombra',
  'alfombra_institucional',
  'fumigacion',
  'vehiculo_profundo',
  'conserjeria_ocasional',
  'conserjeria_contrato',
  'jardineria'
);

CREATE TYPE payment_status AS ENUM (
  'pending',     -- Pendiente de procesar
  'processing',  -- PaymentIntent creado en Stripe
  'paid',        -- Transferido al trabajador
  'failed'       -- Falló el cobro/transferencia
);

CREATE TYPE notification_type AS ENUM (
  'new_job',
  'job_taken',
  'job_completed',
  'payment_sent'
);


-- ================================================================
-- 2. HELPER: función genérica para auto-actualizar updated_at
-- ================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ================================================================
-- 3. TABLA: profiles
--    Extiende auth.users 1:1. Se crea vía trigger al registrarse.
-- ================================================================

CREATE TABLE profiles (
  id                UUID        PRIMARY KEY
                                REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  full_name         TEXT        NOT NULL CHECK (char_length(full_name) >= 2),
  phone             TEXT,
  avatar_url        TEXT,
  role              user_role   NOT NULL DEFAULT 'worker',
  is_approved       BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Stripe Connect: ID de cuenta del trabajador para recibir transferencias
  stripe_account_id TEXT,
  -- Token Expo Push para notificaciones FCM
  fcm_token         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX profiles_role_idx        ON profiles(role);
CREATE INDEX profiles_is_approved_idx ON profiles(is_approved);
CREATE INDEX profiles_email_idx       ON profiles(email);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Auto-crear perfil cuando un usuario se registra en auth.users
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'worker'),
    -- Los admins se auto-aprueban; los workers necesitan aprobación manual
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'worker') = 'admin'
         THEN TRUE ELSE FALSE END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();


-- ================================================================
-- 4. TABLA: worker_profiles
--    Información extendida del trabajador (habilidades, docs, rating)
-- ================================================================

CREATE TABLE worker_profiles (
  worker_id          UUID        PRIMARY KEY
                                 REFERENCES profiles(id) ON DELETE CASCADE,
  bio                TEXT,
  skills             TEXT[]      NOT NULL DEFAULT '{}',
  -- URL del PDF/imagen de ID oficial subido a Storage
  id_document_url    TEXT,
  id_verified        BOOLEAN     NOT NULL DEFAULT FALSE,
  rating_avg         NUMERIC(3,2)         DEFAULT NULL
                                          CHECK (rating_avg BETWEEN 1 AND 5),
  total_reviews      INTEGER     NOT NULL DEFAULT 0,
  total_jobs_done    INTEGER     NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_worker_profiles_updated_at
  BEFORE UPDATE ON worker_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ================================================================
-- 5. TABLA: jobs
-- ================================================================

CREATE TABLE jobs (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            TEXT          NOT NULL CHECK (char_length(title) >= 5),
  description      TEXT          NOT NULL CHECK (char_length(description) >= 10),
  category         job_category  NOT NULL DEFAULT 'limpieza_sofas',
  status           job_status    NOT NULL DEFAULT 'open',
  -- Pago bruto que paga la empresa
  pay_amount       NUMERIC(10,2) NOT NULL CHECK (pay_amount > 0),
  -- 5 % de comisión para la plataforma
  platform_fee     NUMERIC(10,2) NOT NULL CHECK (platform_fee >= 0),
  -- 95 % que recibe el trabajador
  worker_payout    NUMERIC(10,2) NOT NULL CHECK (worker_payout >= 0),
  -- Ubicación
  address          TEXT          NOT NULL,
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  -- Logística
  scheduled_at     TIMESTAMPTZ,
  duration_hours   NUMERIC(4,1)  NOT NULL DEFAULT 4.0 CHECK (duration_hours > 0),
  required_workers INTEGER       NOT NULL DEFAULT 1   CHECK (required_workers >= 1),
  slots_taken      INTEGER       NOT NULL DEFAULT 0   CHECK (slots_taken >= 0),
  -- Archivos adjuntos (fotos/PDFs en Supabase Storage)
  media_urls       TEXT[]        NOT NULL DEFAULT '{}',
  created_by       UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_slots_valid    CHECK (slots_taken <= required_workers),
  CONSTRAINT chk_fee_coherent   CHECK (platform_fee + worker_payout = pay_amount)
);

CREATE INDEX jobs_status_idx      ON jobs(status);
CREATE INDEX jobs_category_idx    ON jobs(category);
CREATE INDEX jobs_created_at_idx  ON jobs(created_at DESC);
CREATE INDEX jobs_created_by_idx  ON jobs(created_by);
CREATE INDEX jobs_scheduled_idx   ON jobs(scheduled_at) WHERE scheduled_at IS NOT NULL;
-- Índice compuesto para el feed principal de workers (status + fecha)
CREATE INDEX jobs_feed_idx        ON jobs(status, created_at DESC) WHERE status = 'open';
-- Índice GIN para búsqueda por texto en título
CREATE INDEX jobs_title_trgm_idx  ON jobs USING GIN (title gin_trgm_ops);

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ================================================================
-- 6. TABLA: job_assignments
--    Un registro por cada worker que acepta un job.
--    AQUÍ VIVE EL LOCK DE CONCURRENCIA.
-- ================================================================

CREATE TABLE job_assignments (
  id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id            UUID           NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id         UUID           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  payment_status    payment_status NOT NULL DEFAULT 'pending',
  -- Stripe PaymentIntent ID para rastrear el cobro
  payment_intent_id TEXT,
  -- Notas internas del admin al cerrar
  admin_notes       TEXT,

  -- Un mismo worker NO puede tomar el mismo job dos veces
  CONSTRAINT uq_job_worker UNIQUE (job_id, worker_id)
);

CREATE INDEX job_assignments_worker_idx ON job_assignments(worker_id);
CREATE INDEX job_assignments_job_idx    ON job_assignments(job_id);
CREATE INDEX job_assignments_payment_idx ON job_assignments(payment_status);


-- ================================================================
-- 7. TABLA: transactions
--    Registro inmutable de cada movimiento de dinero.
-- ================================================================

CREATE TABLE transactions (
  id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id              UUID           NOT NULL REFERENCES jobs(id),
  assignment_id       UUID           NOT NULL REFERENCES job_assignments(id),
  worker_id           UUID           NOT NULL REFERENCES profiles(id),
  -- Montos en la misma moneda que jobs.pay_amount
  gross_amount        NUMERIC(10,2)  NOT NULL CHECK (gross_amount > 0),
  platform_fee        NUMERIC(10,2)  NOT NULL CHECK (platform_fee >= 0),
  worker_amount       NUMERIC(10,2)  NOT NULL CHECK (worker_amount >= 0),
  currency            CHAR(3)        NOT NULL DEFAULT 'USD',
  status              payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id  TEXT,
  stripe_transfer_id        TEXT,
  -- Metadatos del intento de pago
  failure_reason      TEXT,
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_tx_amounts CHECK (platform_fee + worker_amount = gross_amount)
);

CREATE INDEX transactions_worker_idx     ON transactions(worker_id);
CREATE INDEX transactions_job_idx        ON transactions(job_id);
CREATE INDEX transactions_status_idx     ON transactions(status);
CREATE INDEX transactions_created_at_idx ON transactions(created_at DESC);


-- ================================================================
-- 8. TABLA: notifications
-- ================================================================

CREATE TABLE notifications (
  id         UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID              NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT              NOT NULL,
  body       TEXT              NOT NULL,
  type       notification_type NOT NULL,
  -- Payload extra: job_id, screen, etc.
  data       JSONB             NOT NULL DEFAULT '{}',
  read       BOOLEAN           NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE read = FALSE;


-- ================================================================
-- 9. FUNCIÓN AUXILIAR PARA RLS (rompe recursión)
--    SECURITY DEFINER → se ejecuta con permisos del owner, no del caller.
--    Evita la recursión infinita de "leer profiles dentro de una policy de profiles".
-- ================================================================

CREATE OR REPLACE FUNCTION fn_get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION fn_is_approved()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(is_approved, FALSE) FROM profiles WHERE id = auth.uid();
$$;


-- ================================================================
-- 10. ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;

-- ── profiles ────────────────────────────────────────────────────
-- Cualquier usuario autenticado puede ver su propio perfil
CREATE POLICY "profiles: select own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins ven todos los perfiles (usa fn_get_my_role() para evitar recursión)
CREATE POLICY "profiles: admin select all"
  ON profiles FOR SELECT
  USING (fn_get_my_role() = 'admin');

-- Cada usuario actualiza solo su propio perfil
CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Solo admins pueden aprobar/modificar otros perfiles
CREATE POLICY "profiles: admin update all"
  ON profiles FOR UPDATE
  USING (fn_get_my_role() = 'admin');

-- ── worker_profiles ──────────────────────────────────────────────
CREATE POLICY "worker_profiles: select own"
  ON worker_profiles FOR SELECT
  USING (worker_id = auth.uid());

CREATE POLICY "worker_profiles: admin select all"
  ON worker_profiles FOR SELECT
  USING (fn_get_my_role() = 'admin');

CREATE POLICY "worker_profiles: upsert own"
  ON worker_profiles FOR ALL
  USING (worker_id = auth.uid());

-- ── jobs ─────────────────────────────────────────────────────────
-- Workers aprobados ven todos los jobs (sin importar status → para historial)
CREATE POLICY "jobs: approved worker read"
  ON jobs FOR SELECT
  USING (fn_is_approved() = TRUE);

-- Admins gestionan todos los jobs
CREATE POLICY "jobs: admin all"
  ON jobs FOR ALL
  USING (fn_get_my_role() = 'admin');

-- ── job_assignments ──────────────────────────────────────────────
-- Workers ven solo sus propias asignaciones
CREATE POLICY "assignments: worker select own"
  ON job_assignments FOR SELECT
  USING (worker_id = auth.uid());

-- Admins ven y gestionan todas las asignaciones
CREATE POLICY "assignments: admin all"
  ON job_assignments FOR ALL
  USING (fn_get_my_role() = 'admin');

-- ── transactions ─────────────────────────────────────────────────
-- Workers ven solo sus propias transacciones
CREATE POLICY "transactions: worker select own"
  ON transactions FOR SELECT
  USING (worker_id = auth.uid());

-- Admins ven todas
CREATE POLICY "transactions: admin all"
  ON transactions FOR ALL
  USING (fn_get_my_role() = 'admin');

-- ── notifications ────────────────────────────────────────────────
CREATE POLICY "notifications: own"
  ON notifications FOR ALL
  USING (user_id = auth.uid());


-- ================================================================
-- 11. FUNCIÓN RPC: accept_job
--     REGLA DE ORO — Aceptación atómica y concurrentemente segura.
--
--     Mecanismo:
--       • SELECT ... FOR UPDATE NOWAIT  → bloquea el row del job
--         para esta transacción; si otro worker llegó primero y ya
--         tiene el lock, PostgreSQL lanza lock_not_available
--         en lugar de esperar → el segundo worker recibe error
--         inmediato ("Este trabajo ya fue tomado").
--       • UNIQUE (job_id, worker_id)    → segunda línea de defensa
--         a nivel de constraint.
--       • SECURITY DEFINER              → ejecuta con permisos
--         elevados para saltarse RLS dentro de la función.
--
--     Uso desde el cliente:
--       const { data } = await supabase.rpc('accept_job', {
--         p_job_id:    '…uuid…',
--         p_worker_id: '…uuid…',
--       });
--       if (!data.success) Alert.alert(data.error);
-- ================================================================

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
  v_job        jobs%ROWTYPE;
  v_profile    profiles%ROWTYPE;
  v_assignment job_assignments%ROWTYPE;
BEGIN

  -- ── 1. Bloquear el row del job ──────────────────────────────
  --    FOR UPDATE NOWAIT:
  --      Si el row ya está bloqueado por otra transacción concurrente
  --      PostgreSQL lanza la excepción lock_not_available al instante
  --      (no espera). Garantiza que solo 1 worker por vez pase.
  SELECT *
    INTO v_job
    FROM jobs
   WHERE id = p_job_id
     FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Trabajo no encontrado'
    );
  END IF;

  -- ── 2. Validar estado del job ───────────────────────────────
  IF v_job.status != 'open' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Este trabajo ya fue tomado'
    );
  END IF;

  -- ── 3. Validar slots disponibles ───────────────────────────
  IF v_job.slots_taken >= v_job.required_workers THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Este trabajo ya fue tomado'
    );
  END IF;

  -- ── 4. Validar que el worker existe y está aprobado ─────────
  SELECT *
    INTO v_profile
    FROM profiles
   WHERE id = p_worker_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Trabajador no encontrado'
    );
  END IF;

  IF v_profile.role != 'worker' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Solo los trabajadores pueden aceptar chambas'
    );
  END IF;

  IF v_profile.is_approved = FALSE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Tu cuenta aún no está aprobada por el administrador'
    );
  END IF;

  -- ── 5. Evitar que el mismo worker acepte dos veces ──────────
  IF EXISTS (
    SELECT 1
      FROM job_assignments
     WHERE job_id   = p_job_id
       AND worker_id = p_worker_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Ya tomaste este trabajo anteriormente'
    );
  END IF;

  -- ── 6. Crear la asignación ──────────────────────────────────
  INSERT INTO job_assignments (job_id, worker_id)
  VALUES (p_job_id, p_worker_id)
  RETURNING * INTO v_assignment;

  -- ── 7. Actualizar slots; cambiar status si se llenaron ──────
  UPDATE jobs
     SET slots_taken = slots_taken + 1,
         status      = CASE
                         WHEN slots_taken + 1 >= required_workers
                         THEN 'taken'::job_status
                         ELSE status
                       END
   WHERE id = p_job_id;

  -- ── 8. Crear registro de transacción en estado pending ──────
  INSERT INTO transactions (
    job_id,
    assignment_id,
    worker_id,
    gross_amount,
    platform_fee,
    worker_amount,
    currency
  ) VALUES (
    p_job_id,
    v_assignment.id,
    p_worker_id,
    v_job.pay_amount,
    v_job.platform_fee,
    v_job.worker_payout,
    'USD'
  );

  -- ── 9. Retornar éxito ───────────────────────────────────────
  RETURN jsonb_build_object(
    'success',       true,
    'assignment_id', v_assignment.id,
    'job_id',        p_job_id,
    'worker_id',     p_worker_id,
    'worker_payout', v_job.worker_payout
  );

-- ── Manejo de excepciones ──────────────────────────────────────
EXCEPTION
  -- Otro worker tenía el row bloqueado → rechazo inmediato
  WHEN lock_not_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Este trabajo ya fue tomado'
    );
  -- Race condition llegó igual hasta el INSERT → constraint UNIQUE atrapó
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Este trabajo ya fue tomado'
    );
  -- Check constraint violado (slots_taken > required_workers)
  WHEN check_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Este trabajo ya fue tomado'
    );

END;
$$;


-- ================================================================
-- 12. REALTIME — Suscripciones en tiempo real
-- ================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE job_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- ================================================================
-- 13. PRIMER ADMIN (ejecutar después de crear el usuario en Auth)
-- ================================================================
--
--   Reemplaza el email y ejecuta esto una sola vez:
--
--   UPDATE profiles
--      SET role = 'admin', is_approved = TRUE
--    WHERE email = 'admin@tuempresa.com';
--
-- ================================================================
