-- CHAMBA 023 — Chat en tiempo real entre cliente y técnico (por servicio/job)
SET statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS mensajes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_id  UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  remitente_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  texto        TEXT NOT NULL CHECK (
    char_length(trim(texto)) > 0 AND char_length(texto) <= 2000
  ),
  creado_al    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_servicio_creado
  ON mensajes (servicio_id, creado_al ASC);

COMMENT ON TABLE mensajes IS 'Mensajes de chat 1:1 cliente↔técnico por solicitud (servicio_id = jobs.id)';

-- ─── Helpers RLS ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION job_chat_is_participant(p_servicio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = p_servicio_id
      AND j.status <> 'cancelled'
      AND (
        j.created_by = auth.uid()
        OR j.assigned_worker_id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION job_chat_is_writable(p_servicio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = p_servicio_id
      AND j.status IN ('taken', 'in_progress')
      AND (
        j.created_by = auth.uid()
        OR j.assigned_worker_id = auth.uid()
      )
  );
$$;

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensajes_select_participant ON mensajes;
CREATE POLICY mensajes_select_participant ON mensajes
  FOR SELECT
  USING (job_chat_is_participant(servicio_id));

DROP POLICY IF EXISTS mensajes_insert_participant ON mensajes;
CREATE POLICY mensajes_insert_participant ON mensajes
  FOR INSERT
  WITH CHECK (
    remitente_id = auth.uid()
    AND job_chat_is_writable(servicio_id)
  );

-- Realtime: INSERT en mensajes
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mensajes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
