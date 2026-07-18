import type { Ionicons } from '@expo/vector-icons';
import { CONFIG } from '@constants/config';
import { CATEGORY_LABELS, CATEGORY_EMOJIS } from '@constants/chambaCategories';
import type { JobCategory } from '@constants/chambaCategories';
import {
  CONFIGURED_SERVICE_SEEDS,
  getConfiguredServiceLabel,
} from '@constants/servicesConfig';
import type { JobStatus } from '@/types';

/** Formats a number as Nicaraguan córdobas (C$). */
export const formatCurrency = (amount: number): string => {
  try {
    const formatted = new Intl.NumberFormat('es-NI', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${CONFIG.platform.currencySymbol} ${formatted}`;
  } catch {
    return `${CONFIG.platform.currencySymbol} ${amount.toFixed(2)}`;
  }
};

/** Formats a Date or ISO string as a readable date. */
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/** Formats a Date or ISO string as time. */
export const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

/** Formats a Date or ISO string as relative time (e.g. "hace 5 min"). */
export const formatRelativeTime = (dateStr: string): string => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return `hace ${diffSec}s`;
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  return `hace ${Math.floor(diffSec / 86400)} días`;
};

/** Formats distance in km, uses "m" for < 1 km. */
export const formatDistance = (km: number): string => {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
};

/** Returns display label for job status. */
export const getStatusLabel = (status: JobStatus): string => {
  const labels: Record<JobStatus, string> = {
    pending: 'Pendiente',
    assigned: 'Asignado',
    arrived: 'Técnico en sitio',
    rejected: 'Rechazado',
    open: 'Disponible',
    taken: 'En proceso',
    in_progress: 'En proceso',
    completed: 'Finalizado',
    cancelled: 'Cancelado',
    pending_bidding: 'Contraoferta',
    counter_offered: 'Contraoferta',
  };
  return labels[status] ?? status;
};

/** Etiqueta corta para historial (trabajador / cliente / admin). */
export const getServiceStatusLabel = (status: JobStatus): string => {
  if (status === 'completed') return 'Finalizado';
  if (status === 'in_progress' || status === 'taken') return 'En proceso';
  if (status === 'open') return 'Publicada';
  return getStatusLabel(status);
};

/** Etiqueta para el cliente según fase operativa del técnico. */
export const getClientOrderStatusLabel = (
  status: JobStatus,
  operationalPhase?: string | null,
): string => {
  if (status === 'completed') return 'Completado';
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'open') return 'Elegí tu técnico';
  if (operationalPhase === 'en_route') return 'Técnico en camino';
  if (operationalPhase === 'arrived' || status === 'in_progress') return 'Técnico en el lugar';
  if (operationalPhase === 'accepted' || status === 'taken') return 'Técnico asignado';
  return 'En proceso';
};

/** Returns display label for job category / service slug (catálogo canónico primero). */
export const getCategoryLabel = (category?: JobCategory | string | null): string => {
  if (!category) return 'Servicio';
  return getConfiguredServiceLabel(category)
    ?? CATEGORY_LABELS[category as JobCategory]
    ?? category;
};

/** Returns category emoji. */
export const getCategoryEmoji = (category: JobCategory): string => {
  const fromSeed = CONFIGURED_SERVICE_SEEDS.find((s) => s.slug === category)?.icon;
  return fromSeed ?? CATEGORY_EMOJIS[category] ?? '💼';
};

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Icono vectorial por categoría — reemplaza el emoji en las tarjetas de
 * "servicio activo" (ClientActiveServiceCard / JobActiveScreen), donde el
 * emoji renderizaba con calidad inconsistente entre plataformas. Cubre los
 * slugs reales del catálogo (CONFIGURED_SERVICE_SEEDS) + las categorías
 * legadas (JobCategory), con un ícono genérico de respaldo.
 */
const CATEGORY_ICON_NAMES: Record<string, IoniconName> = {
  // Limpieza
  limpieza_sofas: 'bed-outline',
  limpieza_banos: 'water-outline',
  limpieza_alfombra: 'layers-outline',
  conserjeria_ocasional: 'home-outline',
  conserjeria_contrato: 'calendar-outline',
  limpieza: 'sparkles-outline',
  // Mantenimiento / AC / Jardinería
  ac_limpieza_filtros: 'snow-outline',
  ac_mantenimiento: 'snow-outline',
  ac_revision: 'snow-outline',
  ac_recarga: 'snow-outline',
  jardineria_corte: 'leaf-outline',
  jardineria_poda: 'leaf-outline',
  jardineria_patio: 'leaf-outline',
  jardineria: 'leaf-outline',
  mantenimiento: 'construct-outline',
  // Vehículos
  vehiculo_lavado_regular: 'car-sport-outline',
  vehiculo_limpieza_profunda: 'car-sport-outline',
  vehiculo_aceite_filtro: 'car-sport-outline',
  vehiculo_pulido_pasteado: 'car-sport-outline',
  vehiculos: 'car-sport-outline',
  // Especializados
  electricista: 'flash-outline',
  plomeria: 'water-outline',
  linea_blanca: 'cube-outline',
  especializados: 'flash-outline',
  // Mascotas
  pet_bano: 'paw-outline',
  pet_paseo: 'paw-outline',
  pet_grooming: 'paw-outline',
  pet_personalizado: 'paw-outline',
  mascotas: 'paw-outline',
  // Express
  mandados_express: 'bicycle-outline',
  express: 'bicycle-outline',
  // Empresa
  alfombra_institucional: 'business-outline',
  fumigacion: 'bug-outline',
  b2b_personal_operativo: 'cube-outline',
  b2b_mesero_barman: 'restaurant-outline',
  b2b_ayudante_cocina: 'restaurant-outline',
  b2b_apoyo_hogar: 'home-outline',
  b2b_conserje_empresa: 'business-outline',
  b2b_otro_servicio: 'briefcase-outline',
  empresa: 'business-outline',
};

/** Icono vectorial (Ionicons) por categoría, con respaldo genérico. */
export const getCategoryIconName = (category?: JobCategory | string | null): IoniconName =>
  (category && CATEGORY_ICON_NAMES[category]) || 'briefcase-outline';

/** Coerce Supabase NUMERIC / string fields to number. */
export const coerceNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Rating 1–5 para UI (PostgreSQL NUMERIC suele llegar como string). */
export const formatRatingAvg = (value: unknown): string => {
  const n = coerceNumber(value, NaN);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toFixed(1);
};

/** @deprecated Prefer `haversineDistanceKm` from `@utils/geoDistance`. */
export { haversineDistanceKm as haversineDistance } from '@utils/geoDistance';
