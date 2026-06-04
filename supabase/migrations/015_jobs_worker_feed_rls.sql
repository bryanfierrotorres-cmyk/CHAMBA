-- CHAMBA 015 — Técnicos ven solicitudes abiertas; funciones RLS + RPC feed
-- Ejecutar en Supabase SQL Editor si el técnico no recibe chambas del cliente.

SET statement_timeout = '120s';

-- ── Helpers RLS (pueden faltar si solo se aplicó 005) ─────────────────────
CREATE OR REPLACE FUNCTION fn_get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION fn_is_approved()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_approved, FALSE) FROM profiles WHERE id = auth.uid();
$$;

-- ── SELECT: técnico aprobado ve jobs (feed + detalle) ─────────────────────
DROP POLICY IF EXISTS "jobs: approved worker read" ON jobs;
CREATE POLICY "jobs: approved worker read"
  ON jobs FOR SELECT
  USING (fn_is_approved() = TRUE);

-- ── Admin: gestión completa ───────────────────────────────────────────────
DROP POLICY IF EXISTS "jobs: admin all" ON jobs;
CREATE POLICY "jobs: admin all"
  ON jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'admin'
    )
  );

-- Las políticas de cliente (005) siguen activas en paralelo (OR):
--   jobs: client select own / jobs: client insert own

-- ── RPC: feed de trabajos abiertos (respaldo si SELECT directo falla) ────
CREATE OR REPLACE FUNCTION get_open_jobs_feed(
  p_status       TEXT DEFAULT 'open',
  p_categories   TEXT[] DEFAULT NULL,
  p_limit        INT DEFAULT 20,
  p_offset       INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión requerida');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (
        (p.role::text = 'worker' AND COALESCE(p.is_approved, FALSE) = TRUE)
        OR p.role::text = 'admin'
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Colaborador no aprobado');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM jobs j
  WHERE (p_status IS NULL OR j.status::text = p_status)
    AND (
      p_categories IS NULL
      OR cardinality(p_categories) = 0
      OR j.category::text = ANY (p_categories)
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT j.*
    FROM jobs j
    WHERE (p_status IS NULL OR j.status::text = p_status)
      AND (
        p_categories IS NULL
        OR cardinality(p_categories) = 0
        OR j.category::text = ANY (p_categories)
      )
    ORDER BY j.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0)
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'jobs', v_rows,
    'count', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_open_jobs_feed(TEXT, TEXT[], INT, INT) TO authenticated;
