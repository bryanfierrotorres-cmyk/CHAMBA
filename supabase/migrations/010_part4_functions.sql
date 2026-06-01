-- CHAMBA 010 — Parte 4/4: funciones RPC (catálogo + crear job)
-- Ejecutar después de la Parte 3.

SET statement_timeout = '120s';

CREATE OR REPLACE FUNCTION get_active_catalog()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'categories', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'slug', c.slug, 'name', c.name,
          'icon', c.icon, 'image_url', c.image_url, 'sort_order', c.sort_order
        ) ORDER BY c.sort_order, c.name
      )
      FROM service_categories c WHERE c.is_active
    ), '[]'::jsonb),
    'service_types', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id, 'category_id', t.category_id, 'category_slug', c.slug,
          'slug', t.slug, 'name', t.name, 'description', t.description,
          'icon', t.icon, 'image_url', t.image_url,
          'suggested_price', t.suggested_price, 'min_price_ratio', t.min_price_ratio,
          'sort_order', t.sort_order
        ) ORDER BY c.sort_order, t.sort_order, t.name
      )
      FROM service_types t
      JOIN service_categories c ON c.id = t.category_id
      WHERE t.is_active AND c.is_active
    ), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION get_active_catalog() TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_upsert_category(
  p_admin_id UUID,
  p_slug     TEXT,
  p_name     TEXT,
  p_icon     TEXT DEFAULT '📋',
  p_image_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row service_categories%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role::text = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo administradores');
  END IF;

  INSERT INTO service_categories (slug, name, icon, image_url)
  VALUES (lower(trim(p_slug)), trim(p_name), COALESCE(NULLIF(trim(p_icon), ''), '📋'), p_image_url)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    image_url = COALESCE(EXCLUDED.image_url, service_categories.image_url),
    is_active = TRUE,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('success', true, 'category', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_category TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_upsert_service_type(
  p_admin_id        UUID,
  p_category_slug   TEXT,
  p_slug            TEXT,
  p_name            TEXT,
  p_icon            TEXT DEFAULT '🔧',
  p_description     TEXT DEFAULT NULL,
  p_suggested_price NUMERIC DEFAULT 0,
  p_image_url       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_id UUID;
  v_row    service_types%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role::text = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo administradores');
  END IF;

  SELECT id INTO v_cat_id FROM service_categories
  WHERE slug = lower(trim(p_category_slug)) AND is_active LIMIT 1;

  IF v_cat_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Categoría no encontrada');
  END IF;

  INSERT INTO service_types (
    category_id, slug, name, description, icon, image_url, suggested_price
  ) VALUES (
    v_cat_id, lower(trim(p_slug)), trim(p_name), p_description,
    COALESCE(NULLIF(trim(p_icon), ''), '🔧'), p_image_url,
    GREATEST(COALESCE(p_suggested_price, 0), 0)
  )
  ON CONFLICT (category_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    image_url = COALESCE(EXCLUDED.image_url, service_types.image_url),
    suggested_price = EXCLUDED.suggested_price,
    is_active = TRUE,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('success', true, 'service_type', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_service_type TO anon, authenticated;

CREATE OR REPLACE FUNCTION create_client_job(
  p_created_by       UUID,
  p_title            TEXT,
  p_description      TEXT,
  p_category         TEXT,
  p_pay_amount       NUMERIC,
  p_address          TEXT,
  p_lat              DOUBLE PRECISION,
  p_lng              DOUBLE PRECISION,
  p_duration_hours   NUMERIC DEFAULT 2,
  p_required_workers INTEGER DEFAULT 1,
  p_scheduled_at     TIMESTAMPTZ DEFAULT NULL,
  p_media_urls       TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job   jobs%ROWTYPE;
  v_fee   NUMERIC;
  v_payout NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_created_by) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil de cliente no encontrado');
  END IF;

  v_fee    := ROUND(p_pay_amount * 0.05, 2);
  v_payout := ROUND(p_pay_amount * 0.95, 2);

  INSERT INTO jobs (
    title, description, category, status,
    pay_amount, platform_fee, worker_payout,
    address, lat, lng, scheduled_at,
    duration_hours, required_workers, slots_taken,
    media_urls, created_by
  ) VALUES (
    p_title, p_description, lower(trim(p_category)), 'open',
    p_pay_amount, v_fee, v_payout,
    p_address, p_lat, p_lng, p_scheduled_at,
    p_duration_hours, p_required_workers, 0,
    COALESCE(p_media_urls, '{}'), p_created_by
  )
  RETURNING * INTO v_job;

  RETURN jsonb_build_object('success', true, 'job', to_jsonb(v_job));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION create_client_job TO anon, authenticated;
