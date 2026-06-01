-- CHAMBA 010 — Parte 2/4: datos iniciales (8 servicios)
-- Ejecutar después de la Parte 1.

SET statement_timeout = '120s';

INSERT INTO service_categories (slug, name, icon, sort_order) VALUES
  ('limpieza',  'Limpieza',  '✨', 1),
  ('vehiculos', 'Vehículos', '🚗', 2),
  ('hogar',     'Hogar',     '🏠', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO service_types (category_id, slug, name, description, icon, suggested_price, sort_order)
SELECT c.id, v.slug, v.name, v.description, v.icon, v.price, v.ord
FROM (VALUES
  ('limpieza',  'limpieza_sofas',          'Limpieza de Sofás',                  'Tapicería, cuero y tela',          '🛋️', 1400, 1),
  ('limpieza',  'limpieza_alfombra',       'Limpieza de Alfombra',               'Residencial profunda',             '🏠', 950,  2),
  ('limpieza',  'alfombra_institucional',  'Limpieza de Alfombra Institucional', 'Oficinas y centros comerciales',   '🏢', 1800, 3),
  ('limpieza',  'fumigacion',              'Fumigación',                         'Control de plagas certificado',    '🪲', 1200, 4),
  ('vehiculos', 'vehiculo_profundo',       'Limpieza Profunda de Vehículo',      'Interior y exterior',              '🚗', 900,  1),
  ('hogar',     'conserjeria_ocasional',   'Conserjería Ocasional',              'Limpieza puntual por evento',      '⏰', 850,  1),
  ('hogar',     'conserjeria_contrato',    'Conserjería por Contrato',           'Servicio mensual fijo',            '📋', 2500, 2),
  ('hogar',     'jardineria',              'Jardinería',                         'Poda, riego y mantenimiento',      '🌿', 1000, 3)
) AS v(cat_slug, slug, name, description, icon, price, ord)
JOIN service_categories c ON c.slug = v.cat_slug
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  suggested_price = EXCLUDED.suggested_price,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;
