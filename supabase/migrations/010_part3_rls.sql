-- CHAMBA 010 — Parte 3/4: políticas RLS del catálogo
-- Ejecutar después de la Parte 2.

SET statement_timeout = '60s';

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog: public read categories" ON service_categories;
CREATE POLICY "catalog: public read categories"
  ON service_categories FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "catalog: public read types" ON service_types;
CREATE POLICY "catalog: public read types"
  ON service_types FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "catalog: admin all categories" ON service_categories;
CREATE POLICY "catalog: admin all categories"
  ON service_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin'));

DROP POLICY IF EXISTS "catalog: admin all types" ON service_types;
CREATE POLICY "catalog: admin all types"
  ON service_types FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role::text = 'admin'));
