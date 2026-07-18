/**
 * Tiles Express del home cliente — alineados con servicesConfig.ts (jerarquía unificada).
 */
import type { ExpressSubmenu } from '@constants/servicesConfig';
import { getConfiguredServiceLabel, getSpecializedServiceSeeds } from '@constants/servicesConfig';

export interface ExpressTileDef {
  id: string;
  title: string;
  slug?: string;
  fallbackPrice?: number;
  priceLabel?: string;
  submenu?: ExpressSubmenu;
  /** Descripción corta para la tarjeta premium del Home (spec v1.0). */
  description?: string;
}

export interface ClientHomeSection {
  id: string;
  title: string;
  subtitle?: string;
  tiles: ExpressTileDef[];
}

export const EXPRESS_SUBMENU_META: Record<
  ExpressSubmenu,
  { sectionTitle: string; sectionSubtitle: string; parentTileId: string }
> = {
  limpieza: {
    sectionTitle: 'Limpieza y Desinfección',
    sectionSubtitle: 'Seleccioná el área específica',
    parentTileId: 'limpieza',
  },
  vehiculos: {
    sectionTitle: 'Servicios Automotrices',
    sectionSubtitle: 'Elegí el tipo de lavado o mantenimiento',
    parentTileId: 'car',
  },
  jardineria: {
    sectionTitle: 'Jardinería',
    sectionSubtitle: 'Césped, poda y áreas verdes',
    parentTileId: 'jardineria',
  },
  ac: {
    sectionTitle: 'Mantenimiento AC',
    sectionSubtitle: 'Mantenimiento y revisión de equipo',
    parentTileId: 'ac',
  },
  mascotas: {
    sectionTitle: 'Cuidado de Mascotas',
    sectionSubtitle: 'Baño, paseo, grooming o pedido a medida',
    parentTileId: 'pet',
  },
};

/** Seis tiles principales Express — mismo orden/layout que la UI original. */
export const EXPRESS_MAIN_TILES: ExpressTileDef[] = [
  { id: 'limpieza', title: 'Limpieza y Desinfección', priceLabel: 'Ver opciones', submenu: 'limpieza', description: 'Hogares y oficinas' },
  { id: 'car', title: 'Servicios Automotrices', priceLabel: 'Ver opciones', submenu: 'vehiculos', description: 'Lavado interior y exterior' },
  { id: 'ac', title: 'Mantenimiento AC', priceLabel: 'Ver opciones', submenu: 'ac', description: 'Revisión y mantenimiento' },
  { id: 'jardineria', title: 'Jardinería', priceLabel: 'Ver opciones', submenu: 'jardineria', description: 'Cuidado de jardines' },
  { id: 'pet', title: 'Cuidado de Mascotas', priceLabel: 'Ver opciones', submenu: 'mascotas', description: 'Baño, paseo y grooming' },
  { id: 'mandados', title: 'Mandados Express', slug: 'mandados_express', fallbackPrice: 100, description: 'Recados y entregas rápidas' },
];

/** Mapa jerárquico unificado (solo datos; no altera layout del home). */
export const CLIENT_HOGAR_SECTIONS: ClientHomeSection[] = [
  {
    id: 'limpieza',
    title: 'Limpieza y Desinfección',
    tiles: [EXPRESS_MAIN_TILES[0]],
  },
  {
    id: 'mantenimiento',
    title: 'Oficios y Mantenimiento',
    tiles: [EXPRESS_MAIN_TILES[2], EXPRESS_MAIN_TILES[3]],
  },
  {
    id: 'vehiculos',
    title: 'Servicios Automotrices',
    tiles: [EXPRESS_MAIN_TILES[1]],
  },
  {
    id: 'mascotas',
    title: 'Cuidado de Mascotas',
    tiles: [EXPRESS_MAIN_TILES[4]],
  },
  {
    id: 'express',
    title: 'Servicios Express',
    tiles: [EXPRESS_MAIN_TILES[5]],
  },
];

export const EXPRESS_SUB_TILES: Record<ExpressSubmenu, ExpressTileDef[]> = {
  limpieza: [
    { id: 'sofas', title: 'Profunda de Sofás', slug: 'limpieza_sofas', fallbackPrice: 1400 },
    { id: 'banos', title: 'Limpieza de Baños', slug: 'limpieza_banos', fallbackPrice: 600 },
    { id: 'alfombra', title: 'Limpieza de Alfombras', slug: 'limpieza_alfombra', fallbackPrice: 500 },
    { id: 'casa', title: 'Limpieza de Casa', slug: 'conserjeria_ocasional', fallbackPrice: 850 },
  ],
  vehiculos: [
    { id: 'regular', title: 'Lavado regular', slug: 'vehiculo_lavado_regular', fallbackPrice: 250 },
    { id: 'profunda', title: 'Limpieza profunda', slug: 'vehiculo_limpieza_profunda', fallbackPrice: 500 },
    { id: 'aceite', title: 'Aceite y filtro', slug: 'vehiculo_aceite_filtro', fallbackPrice: 450 },
    { id: 'pulido', title: 'Pulido o pasteado', slug: 'vehiculo_pulido_pasteado', fallbackPrice: 400 },
  ],
  jardineria: [
    { id: 'corte', title: 'Corte de grama', slug: 'jardineria_corte', fallbackPrice: 300 },
    { id: 'poda', title: 'Poda de arbustos', slug: 'jardineria_poda', fallbackPrice: 450 },
    { id: 'patio', title: 'Limpieza de patio', slug: 'jardineria_patio', fallbackPrice: 550 },
    { id: 'riego', title: 'Riego y mantenimiento', slug: 'jardineria', fallbackPrice: 400 },
  ],
  ac: [
    { id: 'filtros', title: 'Limpieza de filtros', slug: 'ac_limpieza_filtros', fallbackPrice: 350 },
    { id: 'preventivo', title: 'Mantenimiento preventivo', slug: 'ac_mantenimiento', fallbackPrice: 500 },
    { id: 'revision', title: 'Revisión e instalación', slug: 'ac_revision', fallbackPrice: 700 },
    { id: 'recarga', title: 'Recarga de gas', slug: 'ac_recarga', fallbackPrice: 900 },
  ],
  mascotas: [
    { id: 'bano', title: 'Baño e higiene', slug: 'pet_bano', fallbackPrice: 350 },
    { id: 'paseo', title: 'Paseo y ejercicio', slug: 'pet_paseo', fallbackPrice: 200 },
    { id: 'grooming', title: 'Grooming', slug: 'pet_grooming', fallbackPrice: 450 },
    { id: 'personalizado', title: 'Solicitud personalizada', slug: 'pet_personalizado', fallbackPrice: 250 },
  ],
};

/** Servicios especializados — labels desde catálogo canónico. */
export const CLIENT_SPECIALIZED_SERVICES = getSpecializedServiceSeeds().map((seed) => ({
  id: seed.slug,
  title: seed.label,
  slug: seed.slug,
  subtitle:
    seed.slug === 'electricista'
      ? 'Cortocircuitos, paneles y cableado general'
      : seed.slug === 'plomeria'
        ? 'Fugas ocultas, sanitarios y drenajes'
        : 'Refrigeradoras, lavadoras y cocinas',
}));

/** Tab Negocio — orden unificado (sin slugs retirados). */
export const EMPRESA_PREMIUM_ORDER = [
  'alfombra_institucional',
  'conserjeria_contrato',
  'fumigacion',
  'b2b_personal_operativo',
  'b2b_mesero_barman',
  'b2b_ayudante_cocina',
  'b2b_apoyo_hogar',
  'b2b_conserje_empresa',
  'b2b_otro_servicio',
] as const;

export const empresaDisplayName = (slug: string, fallback?: string): string =>
  getConfiguredServiceLabel(slug) ?? fallback ?? slug;

/** Iconos premium: fondo sólido + glifo blanco. */
export const PREMIUM_ICON_BG: Record<string, string> = {
  vehiculo_lavado_regular: '#3B82F6',
  vehiculo_limpieza_profunda: '#3B82F6',
  conserjeria_contrato: '#22C55E',
  alfombra_institucional: '#8B5CF6',
  fumigacion: '#F97316',
  b2b_personal_operativo: '#F97316',
  b2b_mesero_barman: '#3B82F6',
  b2b_ayudante_cocina: '#0D9488',
  b2b_apoyo_hogar: '#22C55E',
  b2b_conserje_empresa: '#8B5CF6',
  b2b_otro_servicio: '#64748B',
};

export const premiumIconBg = (slug: string): string => PREMIUM_ICON_BG[slug] ?? '#0284C7';
