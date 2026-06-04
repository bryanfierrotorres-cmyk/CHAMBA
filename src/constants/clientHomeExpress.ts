/**
 * Tiles Express del home cliente (hogar) y metadatos de submenús.
 */
import type { ExpressSubmenu } from '@constants/servicesConfig';

export interface ExpressTileDef {
  id: string;
  title: string;
  slug?: string;
  fallbackPrice?: number;
  priceLabel?: string;
  submenu?: ExpressSubmenu;
}

export const EXPRESS_SUBMENU_META: Record<
  ExpressSubmenu,
  { sectionTitle: string; sectionSubtitle: string; parentTileId: string }
> = {
  limpieza: {
    sectionTitle: 'Opciones de Limpieza',
    sectionSubtitle: 'Seleccioná el área específica',
    parentTileId: 'limpieza',
  },
  vehiculos: {
    sectionTitle: 'Opciones de Car Wash',
    sectionSubtitle: 'Elegí el tipo de lavado o mantenimiento',
    parentTileId: 'car',
  },
  jardineria: {
    sectionTitle: 'Opciones de Jardinería',
    sectionSubtitle: 'Césped, poda y áreas verdes',
    parentTileId: 'jardineria',
  },
  ac: {
    sectionTitle: 'Opciones de Aire Acondicionado',
    sectionSubtitle: 'Mantenimiento y revisión de equipo',
    parentTileId: 'ac',
  },
  mascotas: {
    sectionTitle: 'Servicio para mascota',
    sectionSubtitle: 'Baño, paseo, grooming o pedido a medida',
    parentTileId: 'pet',
  },
};

/** Seis categorías principales Express (hogar). */
export const EXPRESS_MAIN_TILES: ExpressTileDef[] = [
  { id: 'limpieza', title: 'Limpieza General', priceLabel: 'Ver opciones', submenu: 'limpieza' },
  { id: 'car', title: 'Car Wash', priceLabel: 'Ver opciones', submenu: 'vehiculos' },
  { id: 'ac', title: 'Mantenimiento AC', priceLabel: 'Ver opciones', submenu: 'ac' },
  { id: 'jardineria', title: 'Jardinería', priceLabel: 'Ver opciones', submenu: 'jardineria' },
  { id: 'pet', title: 'Servicio para mascota', priceLabel: 'Ver opciones', submenu: 'mascotas' },
  { id: 'mandados', title: 'Mandados Express', slug: 'mandados_express', fallbackPrice: 100 },
];

export const EXPRESS_SUB_TILES: Record<ExpressSubmenu, ExpressTileDef[]> = {
  limpieza: [
    { id: 'sofas', title: 'Profunda de Sofás', slug: 'limpieza_sofas', fallbackPrice: 1400 },
    { id: 'banos', title: 'Limpieza de Baños', slug: 'limpieza_banos', fallbackPrice: 600 },
    { id: 'casa', title: 'Limpieza de Casa', slug: 'conserjeria_ocasional', fallbackPrice: 850 },
    { id: 'alfombra', title: 'Limpieza de Alfombras', slug: 'limpieza_alfombra', fallbackPrice: 500 },
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

/** Servicios premium en tab Negocio (orden de la UI de referencia). */
export const EMPRESA_PREMIUM_ORDER = [
  'vehiculo_profundo',
  'conserjeria_contrato',
  'alfombra_institucional',
  'fumigacion',
  'b2b_personal_operativo',
  'b2b_mesero_barman',
  'b2b_ayudante_cocina',
  'b2b_apoyo_hogar',
  'b2b_conserje_empresa',
  'b2b_otro_servicio',
] as const;

/** Iconos premium: fondo sólido + glifo blanco (como captura). */
export const PREMIUM_ICON_BG: Record<string, string> = {
  vehiculo_profundo: '#3B82F6',
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
