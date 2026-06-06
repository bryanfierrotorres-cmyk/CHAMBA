/**
 * Catálogo canónico unificado CHAMBA — Cliente, Técnico y Admin.
 */
import type { ServiceCatalog, ServiceType, ServiceCategory } from '@features/catalog/types';

export type ExpressSubmenu = 'limpieza' | 'ac' | 'jardineria' | 'vehiculos' | 'mascotas';

/** Slugs retirados del catálogo (solo alias legacy en chambaCategories). */
export const REMOVED_SERVICE_SLUGS = [
  'vehiculo_exterior',
  'vehiculo_interior',
  'vehiculo_profundo',
  'vehiculo_detallado',
  'pet_care',
] as const;

export type RemovedServiceSlug = (typeof REMOVED_SERVICE_SLUGS)[number];

export interface ServiceSeedDef {
  slug: string;
  label: string;
  description: string;
  icon: string;
  categorySlug: string;
  /** Subgrupo bajo Oficios y Mantenimiento (ac | jardineria). */
  subcategorySlug?: string;
  suggestedPrice: number;
  sortOrder: number;
}

const SEEDS: ServiceSeedDef[] = [
  // ── Limpieza y Desinfección ───────────────────────────────────────────────
  { slug: 'limpieza_sofas', categorySlug: 'limpieza', label: 'Profunda de Sofás', description: 'Tapicería, cuero y tela', icon: '🛋️', suggestedPrice: 1400, sortOrder: 1 },
  { slug: 'limpieza_banos', categorySlug: 'limpieza', label: 'Limpieza de Baños', description: 'Baños y sanitarios', icon: '🚿', suggestedPrice: 600, sortOrder: 2 },
  { slug: 'limpieza_alfombra', categorySlug: 'limpieza', label: 'Limpieza de Alfombras', description: 'Alfombras residenciales', icon: '🧹', suggestedPrice: 500, sortOrder: 3 },
  { slug: 'conserjeria_ocasional', categorySlug: 'limpieza', label: 'Limpieza de Casa', description: 'Limpieza general del hogar', icon: '🏠', suggestedPrice: 850, sortOrder: 4 },

  // ── Oficios y Mantenimiento › AC ──────────────────────────────────────────
  { slug: 'ac_limpieza_filtros', categorySlug: 'mantenimiento', subcategorySlug: 'ac', label: 'Limpieza de filtros', description: 'Filtros y rejillas', icon: '❄️', suggestedPrice: 350, sortOrder: 10 },
  { slug: 'ac_mantenimiento', categorySlug: 'mantenimiento', subcategorySlug: 'ac', label: 'Mantenimiento preventivo', description: 'Mantenimiento de equipo', icon: '🔧', suggestedPrice: 500, sortOrder: 11 },
  { slug: 'ac_revision', categorySlug: 'mantenimiento', subcategorySlug: 'ac', label: 'Revisión e instalación', description: 'Diagnóstico e instalación', icon: '📋', suggestedPrice: 700, sortOrder: 12 },
  { slug: 'ac_recarga', categorySlug: 'mantenimiento', subcategorySlug: 'ac', label: 'Recarga de gas', description: 'Gas refrigerante', icon: '💨', suggestedPrice: 900, sortOrder: 13 },

  // ── Oficios y Mantenimiento › Jardinería ──────────────────────────────────
  { slug: 'jardineria_corte', categorySlug: 'mantenimiento', subcategorySlug: 'jardineria', label: 'Corte de grama', description: 'Césped y nivelación', icon: '🌱', suggestedPrice: 300, sortOrder: 20 },
  { slug: 'jardineria_poda', categorySlug: 'mantenimiento', subcategorySlug: 'jardineria', label: 'Poda de arbustos', description: 'Arbustos y setos', icon: '✂️', suggestedPrice: 450, sortOrder: 21 },
  { slug: 'jardineria_patio', categorySlug: 'mantenimiento', subcategorySlug: 'jardineria', label: 'Limpieza de patio', description: 'Patio y áreas verdes', icon: '🏡', suggestedPrice: 550, sortOrder: 22 },
  { slug: 'jardineria', categorySlug: 'mantenimiento', subcategorySlug: 'jardineria', label: 'Riego y mantenimiento', description: 'Jardín', icon: '🌿', suggestedPrice: 400, sortOrder: 23 },

  // ── Car Wash ────────────────────────────────────────────────────────────────
  { slug: 'vehiculo_lavado_regular', categorySlug: 'vehiculos', label: 'Lavado regular', description: 'Lavado exterior e interior', icon: '🚗', suggestedPrice: 250, sortOrder: 30 },
  { slug: 'vehiculo_limpieza_profunda', categorySlug: 'vehiculos', label: 'Limpieza profunda', description: 'Interior y exterior a fondo', icon: '✨', suggestedPrice: 500, sortOrder: 31 },
  { slug: 'vehiculo_aceite_filtro', categorySlug: 'vehiculos', label: 'Aceite y filtro', description: 'Cambio de aceite y filtro', icon: '🔧', suggestedPrice: 450, sortOrder: 32 },
  { slug: 'vehiculo_pulido_pasteado', categorySlug: 'vehiculos', label: 'Pulido o pasteado', description: 'Acabado premium', icon: '💎', suggestedPrice: 400, sortOrder: 33 },

  // ── Técnicos Especializados ─────────────────────────────────────────────────
  { slug: 'electricista', categorySlug: 'especializados', label: 'Electricista', description: 'Cableado y paneles', icon: '⚡', suggestedPrice: 500, sortOrder: 40 },
  { slug: 'plomeria', categorySlug: 'especializados', label: 'Plomería y Tuberías', description: 'Fugas y drenajes', icon: '🔧', suggestedPrice: 500, sortOrder: 41 },
  { slug: 'linea_blanca', categorySlug: 'especializados', label: 'Reparación de Línea Blanca', description: 'Refrigeradoras y lavadoras', icon: '🧊', suggestedPrice: 500, sortOrder: 42 },

  // ── Cuidado de Mascotas ─────────────────────────────────────────────────────
  { slug: 'pet_bano', categorySlug: 'mascotas', label: 'Baño e higiene', description: 'Baño para mascotas', icon: '🛁', suggestedPrice: 350, sortOrder: 50 },
  { slug: 'pet_paseo', categorySlug: 'mascotas', label: 'Paseo y ejercicio', description: 'Paseo y ejercicio', icon: '🐕', suggestedPrice: 200, sortOrder: 51 },
  { slug: 'pet_grooming', categorySlug: 'mascotas', label: 'Grooming', description: 'Estética y cuidado', icon: '✂️', suggestedPrice: 450, sortOrder: 52 },
  { slug: 'pet_personalizado', categorySlug: 'mascotas', label: 'Solicitud personalizada', description: 'Servicio a medida', icon: '📋', suggestedPrice: 250, sortOrder: 53 },

  // ── Servicios Express ───────────────────────────────────────────────────────
  { slug: 'mandados_express', categorySlug: 'express', label: 'Mandados Express', description: 'Recados rápidos', icon: '🛵', suggestedPrice: 100, sortOrder: 60 },

  // ── Para tu Negocio ─────────────────────────────────────────────────────────
  { slug: 'alfombra_institucional', categorySlug: 'empresa', label: 'Alfombra institucional', description: 'Oficinas y comercios', icon: '🏢', suggestedPrice: 1800, sortOrder: 70 },
  { slug: 'conserjeria_contrato', categorySlug: 'empresa', label: 'Conserjería por contrato', description: 'Servicio mensual', icon: '📋', suggestedPrice: 2500, sortOrder: 71 },
  { slug: 'fumigacion', categorySlug: 'empresa', label: 'Fumigación', description: 'Control de plagas', icon: '🪲', suggestedPrice: 1200, sortOrder: 72 },
  { slug: 'b2b_personal_operativo', categorySlug: 'empresa', label: 'Personal operativo', description: 'Carga y apoyo en tu local', icon: '📦', suggestedPrice: 900, sortOrder: 73 },
  { slug: 'b2b_mesero_barman', categorySlug: 'empresa', label: 'Mesero / Barman', description: 'Atención por turno', icon: '🍽️', suggestedPrice: 1200, sortOrder: 74 },
  { slug: 'b2b_ayudante_cocina', categorySlug: 'empresa', label: 'Ayudante de cocina', description: 'Apoyo en cocina', icon: '👨‍🍳', suggestedPrice: 1100, sortOrder: 75 },
  { slug: 'b2b_apoyo_hogar', categorySlug: 'empresa', label: 'Apoyo del hogar', description: 'Orden y apoyo en espacios', icon: '🏠', suggestedPrice: 950, sortOrder: 76 },
  { slug: 'b2b_conserje_empresa', categorySlug: 'empresa', label: 'Conserje', description: 'Limpieza de instalaciones', icon: '🧹', suggestedPrice: 1400, sortOrder: 77 },
  { slug: 'b2b_otro_servicio', categorySlug: 'empresa', label: 'Otro servicio', description: 'Perfil específico', icon: '📋', suggestedPrice: 800, sortOrder: 78 },
];

export const CONFIGURED_SERVICE_SEEDS = SEEDS;

export const CONFIGURED_CATEGORY_SEEDS = [
  { slug: 'limpieza', name: 'Limpieza y Desinfección', icon: '🧹', sort_order: 1 },
  { slug: 'mantenimiento', name: 'Oficios y Mantenimiento', icon: '🔧', sort_order: 2 },
  { slug: 'vehiculos', name: 'Car Wash', icon: '🚗', sort_order: 3 },
  { slug: 'especializados', name: 'Técnicos Especializados', icon: '⚡', sort_order: 4 },
  { slug: 'mascotas', name: 'Cuidado de Mascotas', icon: '🐕', sort_order: 5 },
  { slug: 'express', name: 'Servicios Express', icon: '🛵', sort_order: 6 },
  { slug: 'empresa', name: 'Para tu Negocio', icon: '🏢', sort_order: 7 },
] as const;

export const CONFIGURED_SUBCATEGORY_SEEDS = [
  { slug: 'ac', parentSlug: 'mantenimiento', name: 'Mantenimiento AC', icon: '❄️', sort_order: 1 },
  { slug: 'jardineria', parentSlug: 'mantenimiento', name: 'Jardinería', icon: '🌿', sort_order: 2 },
] as const;

export const ALL_CONFIGURED_SERVICE_SLUGS = SEEDS.map((s) => s.slug);

export const DEFAULT_SERVICE_SLUG = 'limpieza_sofas';

const B2B_SLUGS = new Set(['alfombra_institucional', 'conserjeria_contrato', 'fumigacion']);

export const isExpressServiceSlug = (slug: string): boolean =>
  !B2B_SLUGS.has(slug) && !slug.startsWith('b2b_');

export const SERVICE_FALLBACK_PRICES: Record<string, number> = Object.fromEntries(
  SEEDS.map((s) => [s.slug, s.suggestedPrice]),
);

export const getConfiguredServiceLabel = (slug: string): string | undefined =>
  SEEDS.find((s) => s.slug === slug)?.label;

export const getConfiguredServiceSeed = (slug: string): ServiceSeedDef | undefined =>
  SEEDS.find((s) => s.slug === slug);

export const getSpecializedServiceSeeds = (): ServiceSeedDef[] =>
  SEEDS.filter((s) => s.categorySlug === 'especializados');

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CONFIGURED_CATEGORY_SEEDS.map((c) => [c.slug, c.name]),
);

const SUBCATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CONFIGURED_SUBCATEGORY_SEEDS.map((s) => [s.slug, s.name]),
);

export interface CatalogGroup {
  group: {
    id: string;
    icon: string;
    label: string;
    parentLabel?: string;
  };
  types: ServiceType[];
}

const resolveGroupMeta = (
  categorySlug: string,
  subcategorySlug?: string | null,
): { id: string; icon: string; label: string; parentLabel?: string } => {
  if (categorySlug === 'mantenimiento' && subcategorySlug) {
    const sub = CONFIGURED_SUBCATEGORY_SEEDS.find((s) => s.slug === subcategorySlug);
    return {
      id: `${categorySlug}:${subcategorySlug}`,
      icon: sub?.icon ?? '🔧',
      label: SUBCATEGORY_LABELS[subcategorySlug] ?? subcategorySlug,
      parentLabel: CATEGORY_LABELS.mantenimiento,
    };
  }

  const cat = CONFIGURED_CATEGORY_SEEDS.find((c) => c.slug === categorySlug);
  return {
    id: categorySlug,
    icon: cat?.icon ?? '📋',
    label: CATEGORY_LABELS[categorySlug] ?? categorySlug,
  };
};

export const sortServiceTypesByConfig = (types: ServiceType[]): ServiceType[] =>
  [...types].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

/** Agrupa servicios según la jerarquía unificada (incluye subcategorías de mantenimiento). */
export const buildGroupedServiceTypes = (types: ServiceType[]): CatalogGroup[] => {
  const allowed = new Set(ALL_CONFIGURED_SERVICE_SLUGS);
  const filtered = types.filter((t) => allowed.has(t.slug));

  const byGroup = new Map<string, ServiceType[]>();
  const groupMeta = new Map<string, CatalogGroup['group']>();

  for (const type of filtered) {
    const seed = getConfiguredServiceSeed(type.slug);
    const categorySlug = seed?.categorySlug ?? type.category_slug;
    const subcategorySlug = seed?.subcategorySlug ?? type.subcategory_slug ?? null;
    const meta = resolveGroupMeta(categorySlug, subcategorySlug);

    if (!byGroup.has(meta.id)) {
      byGroup.set(meta.id, []);
      groupMeta.set(meta.id, meta);
    }
    byGroup.get(meta.id)!.push(type);
  }

  const order = [
    'limpieza',
    'mantenimiento:ac',
    'mantenimiento:jardineria',
    'vehiculos',
    'especializados',
    'mascotas',
    'express',
    'empresa',
  ];

  const groups: CatalogGroup[] = [];
  for (const id of order) {
    const list = byGroup.get(id);
    if (!list?.length) continue;
    groups.push({
      group: groupMeta.get(id)!,
      types: sortServiceTypesByConfig(list),
    });
    byGroup.delete(id);
  }

  for (const [id, list] of byGroup) {
    groups.push({
      group: groupMeta.get(id) ?? { id, icon: '📋', label: id },
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
    subcategory_slug: def.subcategorySlug ?? null,
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
