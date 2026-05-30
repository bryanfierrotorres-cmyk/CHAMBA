/**
 * Fuente única de verdad — 8 categorías oficiales de CHAMBA.
 * Cliente, Colaborador y Administrador deben usar estos mismos IDs.
 */
export const CHAMBA_CATEGORY_IDS = [
  'limpieza_sofas',
  'limpieza_alfombra',
  'alfombra_institucional',
  'fumigacion',
  'vehiculo_profundo',
  'conserjeria_ocasional',
  'conserjeria_contrato',
  'jardineria',
] as const;

export type JobCategory = (typeof CHAMBA_CATEGORY_IDS)[number];

export type ClientCategory = JobCategory;

/** @deprecated Usar JobCategory directamente; mapa 1:1 por compatibilidad. */
export const CLIENT_CATEGORY_MAP: Record<ClientCategory, JobCategory> = Object.fromEntries(
  CHAMBA_CATEGORY_IDS.map((id) => [id, id]),
) as Record<ClientCategory, JobCategory>;

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  limpieza_sofas:          'Limpieza de Sofás',
  limpieza_alfombra:       'Limpieza de Alfombra',
  alfombra_institucional:  'Limpieza de Alfombra Institucional',
  fumigacion:              'Fumigación',
  vehiculo_profundo:       'Limpieza Profunda y Detallado de Vehículo',
  conserjeria_ocasional:   'Conserjería Ocasional',
  conserjeria_contrato:    'Conserjería por Contrato',
  jardineria:              'Jardinería',
};

export const CATEGORY_EMOJIS: Record<JobCategory, string> = {
  limpieza_sofas:          '🛋️',
  limpieza_alfombra:       '🏠',
  alfombra_institucional:  '🏢',
  fumigacion:              '🪲',
  vehiculo_profundo:       '🚗',
  conserjeria_ocasional:   '⏰',
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

/**
 * Valores del enum `job_category` en Supabase remoto (mezcla legacy + nuevos).
 * Escritura: siempre usar estos valores al insertar/actualizar.
 */
export const DB_JOB_CATEGORY: Record<JobCategory, string> = {
  limpieza_sofas:          'sofas',
  limpieza_alfombra:       'alfombra',
  alfombra_institucional:  'alfombra_institucional',
  fumigacion:              'fumigacion',
  vehiculo_profundo:       'vehiculos',
  conserjeria_ocasional:   'conserjeria_ocasional',
  conserjeria_contrato:    'conserjeria_contrato',
  jardineria:              'jardineria',
};

/** Alias legados en filas antiguas de la BD. */
const LEGACY_DB_TO_APP: Record<string, JobCategory> = {
  sofas:     'limpieza_sofas',
  alfombra:  'limpieza_alfombra',
  vehiculos: 'vehiculo_profundo',
  limpieza:  'limpieza_alfombra',
  ...Object.fromEntries(
    Object.entries(DB_JOB_CATEGORY).map(([app, db]) => [db, app as JobCategory]),
  ) as Record<string, JobCategory>,
};

/** Convierte ID de app → enum Postgres. */
export const toDbJobCategory = (category: JobCategory | string): string =>
  DB_JOB_CATEGORY[category as JobCategory] ?? category;

/** Convierte enum Postgres → ID de app (si aplica). */
export const fromDbJobCategory = (dbCategory: string | null | undefined): JobCategory | null => {
  if (!dbCategory) return null;
  if (isJobCategory(dbCategory)) return dbCategory;
  return LEGACY_DB_TO_APP[dbCategory] ?? null;
};

/** Valores DB a consultar (incluye alias legados usados en filas antiguas). */
export const toDbJobCategoryQueryValues = (category: JobCategory | string): string[] => {
  const primary = toDbJobCategory(category);
  const legacyAliases: Record<string, string[]> = {
    limpieza_sofas:         ['sofas'],
    limpieza_alfombra:      ['alfombra', 'limpieza'],
    vehiculo_profundo:      ['vehiculos'],
  };
  const extras = legacyAliases[category as JobCategory] ?? [];
  return Array.from(new Set([primary, ...extras]));
};
