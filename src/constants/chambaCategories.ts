/**
 * Categorías legacy de CHAMBA — alias de slugs antiguos hacia el catálogo unificado.
 */
import { getConfiguredServiceLabel } from '@constants/servicesConfig';

export const CHAMBA_CATEGORY_IDS = [
  'limpieza_sofas',
  'limpieza_alfombra',
  'alfombra_institucional',
  'fumigacion',
  'vehiculo_limpieza_profunda',
  'conserjeria_ocasional',
  'conserjeria_contrato',
  'jardineria',
] as const;

/** Slug del tipo de servicio (`service_types.slug`); compatible con IDs legacy. */
export type JobCategory = (typeof CHAMBA_CATEGORY_IDS)[number] | string;

export type ClientCategory = string;

/** @deprecated Usar JobCategory directamente; mapa 1:1 por compatibilidad. */
export const CLIENT_CATEGORY_MAP: Record<ClientCategory, JobCategory> = Object.fromEntries(
  CHAMBA_CATEGORY_IDS.map((id) => [id, id]),
) as Record<ClientCategory, JobCategory>;

/** Slugs retirados → reemplazo canónico (jobs históricos). */
export const LEGACY_SLUG_ALIASES: Record<string, JobCategory> = {
  vehiculo_profundo: 'vehiculo_limpieza_profunda',
  vehiculo_exterior: 'vehiculo_lavado_regular',
  vehiculo_interior: 'vehiculo_lavado_regular',
  vehiculo_detallado: 'vehiculo_pulido_pasteado',
  pet_care: 'pet_bano',
  sofas: 'limpieza_sofas',
  alfombra: 'limpieza_alfombra',
  vehiculos: 'vehiculo_limpieza_profunda',
};

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  limpieza_sofas:          'Profunda de Sofás',
  limpieza_alfombra:       'Limpieza de Alfombras',
  alfombra_institucional:  'Alfombra institucional',
  fumigacion:              'Fumigación',
  vehiculo_limpieza_profunda: 'Limpieza profunda',
  conserjeria_ocasional:   'Limpieza de Casa',
  conserjeria_contrato:    'Conserjería por contrato',
  jardineria:              'Riego y mantenimiento',
};

export const CATEGORY_EMOJIS: Record<JobCategory, string> = {
  limpieza_sofas:          '🛋️',
  limpieza_alfombra:       '🧹',
  alfombra_institucional:  '🏢',
  fumigacion:              '🪲',
  vehiculo_limpieza_profunda: '🚗',
  conserjeria_ocasional:   '🏠',
  conserjeria_contrato:    '📋',
  jardineria:              '🌿',
};

export interface ChambaCategoryDef {
  id: JobCategory;
  label: string;
  emoji: string;
}

export const CHAMBA_CATEGORIES: ChambaCategoryDef[] = CHAMBA_CATEGORY_IDS.map((id) => ({
  id,
  label: CATEGORY_LABELS[id],
  emoji: CATEGORY_EMOJIS[id],
}));

export const isJobCategory = (value: string): value is JobCategory =>
  (CHAMBA_CATEGORY_IDS as readonly string[]).includes(value);

/** Mapa de alias para consultas a la DB (incluye alias legados y sub-servicios). */
const QUERY_ALIASES: Record<string, string[]> = {
  limpieza:               ['limpieza_sofas', 'limpieza_banos', 'limpieza_alfombra', 'conserjeria_ocasional', 'sofas', 'alfombra'],
  limpieza_sofas:         ['sofas', 'limpieza_banos', 'conserjeria_ocasional', 'limpieza_alfombra', 'fumigacion', 'alfombra_institucional'],
  limpieza_alfombra:      ['alfombra', 'limpieza'],
  limpieza_banos:         ['limpieza_banos'],
  conserjeria_ocasional:  ['conserjeria_ocasional'],
  vehiculo_limpieza_profunda: ['vehiculos', 'vehiculo_limpieza_profunda'],
  vehiculo_lavado_regular: ['vehiculo_lavado_regular', 'vehiculos'],
  jardineria:             ['jardineria_corte', 'jardineria_poda', 'jardineria_patio'],
};

/**
 * Valores del enum `job_category` en Supabase remoto (mezcla legacy + nuevos).
 */
export const DB_JOB_CATEGORY: Record<JobCategory, string> = {
  limpieza_sofas:          'sofas',
  limpieza_alfombra:       'alfombra',
  alfombra_institucional:  'alfombra_institucional',
  fumigacion:              'fumigacion',
  vehiculo_limpieza_profunda: 'vehiculos',
  conserjeria_ocasional:   'conserjeria_ocasional',
  conserjeria_contrato:    'conserjeria_contrato',
  jardineria:              'jardineria',
};

/** Alias legados en filas antiguas de la BD. */
const LEGACY_DB_TO_APP: Record<string, JobCategory> = {
  sofas:     'limpieza_sofas',
  alfombra:  'limpieza_alfombra',
  vehiculos: 'vehiculo_limpieza_profunda',
  limpieza:  'limpieza_alfombra',
  ...Object.fromEntries(
    Object.entries(DB_JOB_CATEGORY).map(([app, db]) => [db, app as JobCategory]),
  ) as Record<string, JobCategory>,
  ...LEGACY_SLUG_ALIASES,
};

/** Convierte ID de app → enum Postgres. */
export const toDbJobCategory = (category: JobCategory | string): string =>
  DB_JOB_CATEGORY[category as JobCategory] ?? category;

/** Convierte enum Postgres → ID de app (si aplica). */
export const fromDbJobCategory = (dbCategory: string | null | undefined): JobCategory | null => {
  if (!dbCategory) return null;
  if (LEGACY_SLUG_ALIASES[dbCategory]) return LEGACY_SLUG_ALIASES[dbCategory];
  if (isJobCategory(dbCategory)) return dbCategory;
  return LEGACY_DB_TO_APP[dbCategory] ?? dbCategory;
};

/** Etiqueta legible — prioriza catálogo canónico. */
export const getLegacyCategoryLabel = (slug: string): string =>
  getConfiguredServiceLabel(slug)
  ?? CATEGORY_LABELS[slug as JobCategory]
  ?? slug;

/** Valores DB a consultar (incluye alias legados y sub-servicios Express). */
export const toDbJobCategoryQueryValues = (category: JobCategory | string): string[] => {
  const normalized = fromDbJobCategory(category) ?? category;
  const primary = toDbJobCategory(normalized);
  const extras = QUERY_ALIASES[normalized as JobCategory] ?? [];
  const out = new Set<string>([primary, String(normalized), ...extras]);
  if (String(normalized).startsWith('jardineria_')) {
    out.add('jardineria');
  }
  if (String(normalized).startsWith('ac_')) {
    out.add('ac_limpieza_filtros');
  }
  if (String(normalized).startsWith('pet_')) {
    out.add('pet_bano');
  }
  return [...out];
};
