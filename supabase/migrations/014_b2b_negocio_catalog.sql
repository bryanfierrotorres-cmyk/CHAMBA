-- Catálogo "Para tu negocio" — personal operativo (reemplaza servicios B2B legacy)

INSERT INTO service_categories (slug, name, icon, sort_order) VALUES
  ('empresa', 'Para tu negocio', '🏢', 5)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO service_types (category_id, slug, name, description, icon, suggested_price, sort_order)
SELECT c.id, v.slug, v.name, v.description, v.icon, v.price, v.ord
FROM (VALUES
  ('empresa', 'b2b_personal_operativo', 'Personal operativo para carga y apoyo', 'Carga, descarga y apoyo operativo en tu local', '📦', 900,  30),
  ('empresa', 'b2b_mesero_barman',      'Mesero / Barman por Turno',            'Atención en salón, barra y eventos por turno', '🍽️', 1200, 31),
  ('empresa', 'b2b_ayudante_cocina',    'Ayudante de Cocina / Cocinero',        'Apoyo en cocina, preparación y montaje',       '👨‍🍳', 1100, 32),
  ('empresa', 'b2b_apoyo_hogar',        'Apoyo del Hogar (mujer)',              'Apoyo doméstico y orden en espacios de trabajo','🏠', 950,  33),
  ('empresa', 'b2b_conserje_empresa',   'Conserje (empresa)',                   'Limpieza, orden y mantenimiento de instalaciones','🧹', 1400, 34),
  ('empresa', 'b2b_otro_servicio',      'Otro servicio específico',             'Solicitá un perfil específico para tu negocio', '📋', 800,  35)
) AS v(cat_slug, slug, name, description, icon, price, ord)
JOIN service_categories c ON c.slug = v.cat_slug
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  suggested_price = EXCLUDED.suggested_price,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

-- Desactivar slugs que ya no aplican al tab negocio / car wash hogar
UPDATE service_types SET is_active = FALSE
WHERE slug IN (
  'alfombra_institucional',
  'fumigacion',
  'conserjeria_contrato',
  'vehiculo_profundo',
  'vehiculo_detallado'
);
