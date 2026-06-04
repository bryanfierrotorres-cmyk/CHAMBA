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

/** Slug del tipo de servicio (`service_types.slug`); compatible con IDs legacy. */
export type JobCategory = (typeof CHAMBA_CATEGORY_IDS)[number] | string;

export type ClientCategory = string;

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

/** Precios de respaldo si el catálogo remoto no está disponible. */
export const SUGGESTED_PRICES_FALLBACK: Record<string, number> = {
  limpieza_sofas:          1400,
  limpieza_alfombra:       950,
  alfombra_institucional:  1800,
  fumigacion:              1200,
  vehiculo_profundo:       900,
  vehiculo_exterior:       120,
  vehiculo_interior:       150,
  vehiculo_detallado:      400,
  vehiculo_lavado_regular: 250,
  vehiculo_limpieza_profunda: 500,
  vehiculo_aceite_filtro:  450,
  vehiculo_pulido_pasteado: 400,
  b2b_personal_operativo:  900,
  b2b_mesero_barman:       1200,
  b2b_ayudante_cocina:     1100,
  b2b_apoyo_hogar:         950,
  b2b_conserje_empresa:    1400,
  b2b_otro_servicio:       800,
  conserjeria_ocasional:   850,
  conserjeria_contrato:    2500,
  jardineria:              400,
  jardineria_corte:        300,
  jardineria_poda:         450,
  jardineria_patio:        550,
  ac_limpieza_filtros:     350,
  ac_mantenimiento:        500,
  ac_revision:             700,
  ac_recarga:              900,
  pet_care:                250,
  pet_bano:                350,
  pet_paseo:               200,
  pet_cuidado_casa:        450,
  pet_grooming:            450,
  pet_personalizado:       250,
  mandados_express:        100,
};

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
  return LEGACY_DB_TO_APP[dbCategory] ?? dbCategory;
};

/** Valores DB a consultar (incluye alias legados y sub-servicios Express). */
export const toDbJobCategoryQueryValues = (category: JobCategory | string): string[] => {
  const primary = toDbJobCategory(category);
  const legacyAliases: Record<string, string[]> = {
    limpieza:               ['limpieza_sofas', 'limpieza_banos', 'limpieza_alfombra', 'conserjeria_ocasional', 'sofas', 'alfombra'],
    limpieza_sofas:         ['sofas', 'limpieza_banos', 'conserjeria_ocasional', 'limpieza_alfombra', 'fumigacion', 'alfombra_institucional'],
    limpieza_alfombra:      ['alfombra', 'limpieza'],
    limpieza_banos:         ['limpieza_banos'],
    conserjeria_ocasional:  ['conserjeria_ocasional'],
    vehiculo_profundo:      ['vehiculos'],
    jardineria:             ['jardineria_corte', 'jardineria_poda', 'jardineria_patio'],
  };
  const extras = legacyAliases[category as JobCategory] ?? [];
  const out = new Set<string>([primary, ...extras]);
  if (String(category).startsWith('jardineria_')) {
    out.add('jardineria');
  }
  return [...out];
};
