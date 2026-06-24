-- CHAMBA 064 — Motor de Analíticas Internas (analytics_events)
SET statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS analytics_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT        NOT NULL,
  user_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  metadata   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice compuesto para consultas agregadas por evento + rango temporal
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time
  ON analytics_events (event_name, created_at DESC);

-- RLS: cualquier usuario autenticado puede insertar su propio evento
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics: authenticated insert own" ON analytics_events;
CREATE POLICY "analytics: authenticated insert own" ON analytics_events
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Solo admin puede leer (dashboards futuros)
DROP POLICY IF EXISTS "analytics: admin read" ON analytics_events;
CREATE POLICY "analytics: admin read" ON analytics_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

NOTIFY pgrst, 'reload schema';
