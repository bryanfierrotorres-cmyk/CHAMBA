-- CHAMBA 054 — Banners informativos del inicio (cliente), gestión admin aislada

SET statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS home_banners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url     TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_banners_active_order
  ON home_banners (display_order ASC)
  WHERE is_active = true;

COMMENT ON TABLE home_banners IS 'Slider informativo del inicio cliente (módulo aislado)';

CREATE OR REPLACE FUNCTION is_admin_user(p_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = p_uid
      AND role::text = 'admin'
      AND is_approved = true
  );
$$;

ALTER TABLE home_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS home_banners_select ON home_banners;
CREATE POLICY home_banners_select ON home_banners
  FOR SELECT
  USING (is_active = true OR is_admin_user(auth.uid()));

DROP POLICY IF EXISTS home_banners_insert_admin ON home_banners;
CREATE POLICY home_banners_insert_admin ON home_banners
  FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS home_banners_update_admin ON home_banners;
CREATE POLICY home_banners_update_admin ON home_banners
  FOR UPDATE
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS home_banners_delete_admin ON home_banners;
CREATE POLICY home_banners_delete_admin ON home_banners
  FOR DELETE
  USING (is_admin_user(auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS banners_public_read ON storage.objects;
CREATE POLICY banners_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'banners');

DROP POLICY IF EXISTS banners_admin_insert ON storage.objects;
CREATE POLICY banners_admin_insert ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'banners' AND is_admin_user(auth.uid()));

DROP POLICY IF EXISTS banners_admin_update ON storage.objects;
CREATE POLICY banners_admin_update ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'banners' AND is_admin_user(auth.uid()));

DROP POLICY IF EXISTS banners_admin_delete ON storage.objects;
CREATE POLICY banners_admin_delete ON storage.objects
  FOR DELETE
  USING (bucket_id = 'banners' AND is_admin_user(auth.uid()));

NOTIFY pgrst, 'reload schema';
