/**
 * Catálogo canónico de servicios CHAMBA (alineado con migración 011).
 */
import type { ServiceCatalog, ServiceType, ServiceCategory } from '@features/catalog/types';

export type ExpressSubmenu = 'limpieza' | 'jardineria' | 'vehiculos' | 'ac' | 'mascotas';

export interface ServiceSeedDef {
  slug: string;
  label: string;
  description: string;
  icon: string;
  categorySlug: string;
  suggestedPrice: number;
  sortOrder: number;
}

const SEEDS: ServiceSeedDef[] = [
  { slug: 'limpieza_sofas', categorySlug: 'limpieza', label: 'Profunda de Sofás', description: 'Tapicería, cuero y tela', icon: '🛋️', suggestedPrice: 1400, sortOrder: 1 },
  { slug: 'limpieza_banos', categorySlug: 'limpieza', label: 'Limpieza de Baños', description: 'Baños y sanitarios', icon: '🚿', suggestedPrice: 600, sortOrder: 2 },
  { slug: 'conserjeria_ocasional', categorySlug: 'hogar', label: 'Limpieza de Casa', description: 'Limpieza general del hogar', icon: '🏠', suggestedPrice: 850, sortOrder: 3 },
  { slug: 'limpieza_alfombra', categorySlug: 'limpieza', label: 'Limpieza de Alfombras', description: 'Alfombras residenciales', icon: '🧹', suggestedPrice: 500, sortOrder: 4 },
  { slug: 'vehiculo_lavado_regular', categorySlug: 'vehiculos', label: 'Lavado regular', description: 'Lavado exterior e interior', icon: '🚗', suggestedPrice: 250, sortOrder: 10 },
  { slug: 'vehiculo_limpieza_profunda', categorySlug: 'vehiculos', label: 'Limpieza profunda', description: 'Interior y exterior a fondo', icon: '✨', suggestedPrice: 500, sortOrder: 11 },
  { slug: 'vehiculo_aceite_filtro', categorySlug: 'vehiculos', label: 'Aceite y filtro', description: 'Cambio de aceite y filtro', icon: '🔧', suggestedPrice: 450, sortOrder: 12 },
  { slug: 'vehiculo_pulido_pasteado', categorySlug: 'vehiculos', label: 'Pulido o pasteado', description: 'Acabado premium', icon: '💎', suggestedPrice: 400, sortOrder: 13 },
  { slug: 'vehiculo_exterior', categorySlug: 'vehiculos', label: 'Lavado exterior', description: 'Lavado exterior del vehículo', icon: '🚗', suggestedPrice: 120, sortOrder: 14 },
  { slug: 'vehiculo_interior', categorySlug: 'vehiculos', label: 'Lavado interior', description: 'Aspirado y limpieza interior', icon: '🪑', suggestedPrice: 150, sortOrder: 15 },
  { slug: 'vehiculo_profundo', categorySlug: 'vehiculos', label: 'Lavado completo', description: 'Interior y exterior', icon: '✨', suggestedPrice: 250, sortOrder: 16 },
  { slug: 'vehiculo_detallado', categorySlug: 'vehiculos', label: 'Detallado y encerado', description: 'Acabado premium', icon: '💎', suggestedPrice: 400, sortOrder: 17 },
  { slug: 'pet_bano', categorySlug: 'hogar', label: 'Baño e higiene', description: 'Baño para mascotas', icon: '🛁', suggestedPrice: 350, sortOrder: 24 },
  { slug: 'pet_paseo', categorySlug: 'hogar', label: 'Paseo', description: 'Paseo y ejercicio', icon: '🐕', suggestedPrice: 200, sortOrder: 25 },
  { slug: 'pet_grooming', categorySlug: 'hogar', label: 'Grooming', description: 'Estética y cuidado', icon: '✂️', suggestedPrice: 450, sortOrder: 26 },
  { slug: 'pet_personalizado', categorySlug: 'hogar', label: 'Solicitud personalizada', description: 'Servicio a medida', icon: '📋', suggestedPrice: 250, sortOrder: 27 },
  { slug: 'b2b_personal_operativo', categorySlug: 'empresa', label: 'Personal operativo', description: 'Carga y apoyo en tu local', icon: '📦', suggestedPrice: 900, sortOrder: 50 },
  { slug: 'b2b_mesero_barman', categorySlug: 'empresa', label: 'Mesero / Barman', description: 'Atención por turno', icon: '🍽️', suggestedPrice: 1200, sortOrder: 51 },
  { slug: 'b2b_ayudante_cocina', categorySlug: 'empresa', label: 'Ayudante de cocina', description: 'Apoyo en cocina', icon: '👨‍🍳', suggestedPrice: 1100, sortOrder: 52 },
  { slug: 'b2b_apoyo_hogar', categorySlug: 'empresa', label: 'Apoyo del hogar', description: 'Orden y apoyo en espacios', icon: '🏠', suggestedPrice: 950, sortOrder: 53 },
  { slug: 'b2b_conserje_empresa', categorySlug: 'empresa', label: 'Conserje', description: 'Limpieza de instalaciones', icon: '🧹', suggestedPrice: 1400, sortOrder: 54 },
  { slug: 'b2b_otro_servicio', categorySlug: 'empresa', label: 'Otro servicio', description: 'Perfil específico', icon: '📋', suggestedPrice: 800, sortOrder: 55 },
  { slug: 'ac_limpieza_filtros', categorySlug: 'hogar', label: 'Limpieza de filtros', description: 'Filtros y rejillas', icon: '❄️', suggestedPrice: 350, sortOrder: 14 },
  { slug: 'ac_mantenimiento', categorySlug: 'hogar', label: 'Mantenimiento preventivo', description: 'Mantenimiento de equipo', icon: '🔧', suggestedPrice: 500, sortOrder: 15 },
  { slug: 'ac_revision', categorySlug: 'hogar', label: 'Revisión e instalación', description: 'Diagnóstico e instalación', icon: '📋', suggestedPrice: 700, sortOrder: 16 },
  { slug: 'ac_recarga', categorySlug: 'hogar', label: 'Recarga de gas', description: 'Gas refrigerante', icon: '💨', suggestedPrice: 900, sortOrder: 17 },
  { slug: 'jardineria_corte', categorySlug: 'hogar', label: 'Corte de grama', description: 'Césped y nivelación', icon: '🌱', suggestedPrice: 300, sortOrder: 18 },
  { slug: 'jardineria_poda', categorySlug: 'hogar', label: 'Poda de arbustos', description: 'Arbustos y setos', icon: '✂️', suggestedPrice: 450, sortOrder: 19 },
  { slug: 'jardineria_patio', categorySlug: 'hogar', label: 'Limpieza de patio', description: 'Patio y áreas verdes', icon: '🏡', suggestedPrice: 550, sortOrder: 20 },
  { slug: 'jardineria', categorySlug: 'hogar', label: 'Riego y mantenimiento', description: 'Jardín', icon: '🌿', suggestedPrice: 400, sortOrder: 21 },
  { slug: 'pet_care', categorySlug: 'hogar', label: 'Servicio para mascota', description: 'Baño y cuidado', icon: '🐕', suggestedPrice: 250, sortOrder: 22 },
  { slug: 'mandados_express', categorySlug: 'hogar', label: 'Mandados Express', description: 'Recados rápidos', icon: '🛵', suggestedPrice: 100, sortOrder: 23 },
  { slug: 'electricista', categorySlug: 'especializados', label: 'Electricista', description: 'Cableado y paneles', icon: '⚡', suggestedPrice: 500, sortOrder: 30 },
  { slug: 'plomeria', categorySlug: 'especializados', label: 'Plomería', description: 'Fugas y drenajes', icon: '🔧', suggestedPrice: 500, sortOrder: 31 },
  { slug: 'linea_blanca', categorySlug: 'especializados', label: 'Línea blanca', description: 'Refrigeradoras y lavadoras', icon: '🧊', suggestedPrice: 500, sortOrder: 32 },
  { slug: 'alfombra_institucional', categorySlug: 'limpieza', label: 'Alfombra institucional', description: 'Oficinas y comercios', icon: '🏢', suggestedPrice: 1800, sortOrder: 40 },
  { slug: 'fumigacion', categorySlug: 'limpieza', label: 'Fumigación', description: 'Control de plagas', icon: '🪲', suggestedPrice: 1200, sortOrder: 41 },
  { slug: 'conserjeria_contrato', categorySlug: 'hogar', label: 'Conserjería por contrato', description: 'Servicio mensual', icon: '📋', suggestedPrice: 2500, sortOrder: 42 },
];

export const CONFIGURED_SERVICE_SEEDS = SEEDS;

export const CONFIGURED_CATEGORY_SEEDS = [
  { slug: 'limpieza', name: 'Limpieza', icon: '🧹', sort_order: 1 },
  { slug: 'hogar', name: 'Hogar', icon: '🏠', sort_order: 2 },
  { slug: 'vehiculos', name: 'Vehículos', icon: '🚗', sort_order: 3 },
  { slug: 'especializados', name: 'Especializados', icon: '🔧', sort_order: 4 },
  { slug: 'empresa', name: 'Para tu negocio', icon: '🏢', sort_order: 5 },
] as const;

export const ALL_CONFIGURED_SERVICE_SLUGS = SEEDS.map((s) => s.slug);

export const DEFAULT_SERVICE_SLUG = 'limpieza_sofas';

const B2B_SLUGS = new Set(['alfombra_institucional', 'conserjeria_contrato', 'fumigacion']);

export const isExpressServiceSlug = (slug: string): boolean => !B2B_SLUGS.has(slug);

export const SERVICE_FALLBACK_PRICES: Record<string, number> = Object.fromEntries(
  SEEDS.map((s) => [s.slug, s.suggestedPrice]),
);

export const getConfiguredServiceLabel = (slug: string): string | undefined =>
  SEEDS.find((s) => s.slug === slug)?.label;

const CATEGORY_LABELS: Record<string, string> = {
  limpieza: 'Limpieza',
  hogar: 'Hogar y Express',
  vehiculos: 'Vehículos',
  especializados: 'Especializados',
  empresa: 'Para tu negocio',
};

export const sortServiceTypesByConfig = (types: ServiceType[]): ServiceType[] =>
  [...types].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

export const buildGroupedServiceTypes = (
  types: ServiceType[],
): Array<{ group: { id: string; icon: string; label: string }; types: ServiceType[] }> => {
  const byCat = new Map<string, ServiceType[]>();
  for (const t of types) {
    const key = t.category_slug || 'otros';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(t);
  }

  const order = ['limpieza', 'hogar', 'vehiculos', 'especializados'];
  const groups: Array<{ group: { id: string; icon: string; label: string }; types: ServiceType[] }> = [];

  for (const catSlug of order) {
    const list = byCat.get(catSlug);
    if (!list?.length) continue;
    const cat = CONFIGURED_CATEGORY_SEEDS.find((c) => c.slug === catSlug);
    groups.push({
      group: {
        id: catSlug,
        icon: cat?.icon ?? '📋',
        label: CATEGORY_LABELS[catSlug] ?? catSlug,
      },
      types: sortServiceTypesByConfig(list),
    });
    byCat.delete(catSlug);
  }

  for (const [catSlug, list] of byCat) {
    groups.push({
      group: { id: catSlug, icon: '📋', label: catSlug },
      types: sortServiceTypesByConfig(list),
    });
  }

  return groups;
};

export const buildSeedCatalog = (): ServiceCatalog => {
  const categories: ServiceCategory[] = CONFIGURED_CATEGORY_SEEDS.map((c) => ({
    id: `seed-${c.slug}`,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    image_url: null,
    sort_order: c.sort_order,
  }));

  const serviceTypes: ServiceType[] = SEEDS.map((def) => ({
    id: `seed-${def.slug}`,
    category_id: `seed-${def.categorySlug}`,
    category_slug: def.categorySlug,
    slug: def.slug,
    name: def.label,
    description: def.description,
    icon: def.icon,
    image_url: null,
    suggested_price: def.suggestedPrice,
    min_price_ratio: 0.5,
    sort_order: def.sortOrder,
  }));

  return { categories, serviceTypes };
};
