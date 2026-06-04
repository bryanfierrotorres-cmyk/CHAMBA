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
    return new Intl.NumberFormat('es-NI', {
      style:                 'currency',
      currency:              CONFIG.platform.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${CONFIG.platform.currencySymbol}${amount.toFixed(2)}`;
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
    open: 'Disponible',
    taken: 'En proceso',
    in_progress: 'En proceso',
    completed: 'Finalizado',
    cancelled: 'Cancelado',
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
export const getCategoryLabel = (category: JobCategory): string =>
  getConfiguredServiceLabel(category)
  ?? CATEGORY_LABELS[category]
  ?? category;

/** Returns category emoji. */
export const getCategoryEmoji = (category: JobCategory): string => {
  const fromSeed = CONFIGURED_SERVICE_SEEDS.find((s) => s.slug === category)?.icon;
  return fromSeed ?? CATEGORY_EMOJIS[category] ?? '💼';
};

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

/** Calculates Haversine distance between two coords in KM. */
export const haversineDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
