import type { JobCategory } from '@constants/chambaCategories';
import { fromDbJobCategory } from '@constants/chambaCategories';
import {
  EXPRESS_MAIN_TILES,
  EXPRESS_SUB_TILES,
  EXPRESS_SUBMENU_META,
} from '@constants/clientHomeExpress';
import type { ExpressSubmenu } from '@constants/servicesConfig';
import { ALL_CONFIGURED_SERVICE_SLUGS } from '@constants/servicesConfig';
import { CONFIG } from '@constants/config';
import type { UserProfile } from '@/types';

type WorkerCategoryProfile = Pick<
  UserProfile,
  'is_approved' | 'category_1' | 'category_2' | 'category_1_approved' | 'category_2_approved'
>;

/** Especialidades legacy que abren un menú Express completo. */
const LEGACY_SPECIALTY_TO_SUBMENU: Partial<Record<string, ExpressSubmenu>> = {
  vehiculo_profundo: 'vehiculos',
};

const collectSubmenuSlugs = (submenu: ExpressSubmenu): string[] => {
  const slugs = new Set<string>();
  const meta = EXPRESS_SUBMENU_META[submenu];
  if (meta?.parentTileId) slugs.add(meta.parentTileId);

  for (const tile of EXPRESS_SUB_TILES[submenu]) {
    if (tile.slug) slugs.add(tile.slug);
  }
  return [...slugs];
};

const findSubmenuForSlug = (slug: string): ExpressSubmenu | null => {
  for (const [menu, tiles] of Object.entries(EXPRESS_SUB_TILES) as [ExpressSubmenu, typeof EXPRESS_SUB_TILES.limpieza][]) {
    if (tiles.some((t) => t.slug === slug || t.id === slug)) return menu;
  }
  return LEGACY_SPECIALTY_TO_SUBMENU[slug] ?? null;
};

/**
 * Todos los slugs de servicio incluidos al postular/aprobar una especialidad
 * (categoría principal Express + sus sub-servicios).
 */
export const getWorkerCategoryFamily = (slug: string | null | undefined): JobCategory[] => {
  if (!slug) return [];

  const normalized = fromDbJobCategory(slug) ?? slug;
  const out = new Set<string>([normalized]);

  const mainTile = EXPRESS_MAIN_TILES.find((t) => t.id === normalized || t.slug === normalized);
  if (mainTile?.submenu) {
    collectSubmenuSlugs(mainTile.submenu).forEach((s) => out.add(s));
    return [...out] as JobCategory[];
  }

  const submenu = findSubmenuForSlug(normalized);
  if (submenu) {
    collectSubmenuSlugs(submenu).forEach((s) => out.add(s));
    return [...out] as JobCategory[];
  }

  if (normalized.includes('_')) {
    const prefix = normalized.split('_')[0];
    for (const s of ALL_CONFIGURED_SERVICE_SLUGS) {
      if (s === prefix || s.startsWith(`${prefix}_`)) out.add(s);
    }
  }

  return [...out] as JobCategory[];
};

export const expandWorkerFeedCategories = (specialties: JobCategory[]): JobCategory[] => {
  const out = new Set<string>();
  for (const spec of specialties) {
    getWorkerCategoryFamily(spec).forEach((s) => out.add(s));
  }
  return [...out] as JobCategory[];
};

/**
 * Categorías que el colaborador puede ver en el feed.
 * - Requiere aprobación general del admin (`is_approved`).
 * - Categoría 1: visible si está definida y `category_1_approved`.
 * - Categoría 2: solo si `category_2_approved`.
 */
export const getWorkerApprovedCategories = (
  profile: WorkerCategoryProfile | null | undefined,
): JobCategory[] => {
  if (!profile?.is_approved) return [];

  const cats: JobCategory[] = [];
  const cat1 = fromDbJobCategory(profile.category_1);
  const cat2 = fromDbJobCategory(profile.category_2);
  if (cat1 && profile.category_1_approved) {
    cats.push(cat1);
  }
  if (cat2 && profile.category_2_approved) {
    cats.push(cat2);
  }

  if (cats.length === 0 && CONFIG.pilot.enabled) {
    return [...ALL_CONFIGURED_SERVICE_SLUGS] as JobCategory[];
  }

  return cats;
};

/** Categorías usadas para consultar/filtrar el Radar (incluye sub-servicios). */
export const getWorkerFeedCategories = (
  profile: WorkerCategoryProfile | null | undefined,
): JobCategory[] => expandWorkerFeedCategories(getWorkerApprovedCategories(profile));

/** Slugs del catálogo resaltados en perfil (especialidad + sub-servicios incluidos). */
export const getWorkerCatalogHighlightSlugs = (
  profile: WorkerCategoryProfile | null | undefined,
): JobCategory[] => {
  const slugs = new Set<string>();
  const cat1 = fromDbJobCategory(profile?.category_1);
  const cat2 = fromDbJobCategory(profile?.category_2);
  if (cat1 && profile?.category_1_approved) {
    getWorkerCategoryFamily(cat1).forEach((s) => slugs.add(s));
  }
  if (cat2 && profile?.category_2_approved) {
    getWorkerCategoryFamily(cat2).forEach((s) => slugs.add(s));
  }
  return [...slugs] as JobCategory[];
};

export const workerCoversJobCategory = (
  profile: WorkerCategoryProfile | null | undefined,
  jobCategory: JobCategory | string,
): boolean => {
  const jobSlug = fromDbJobCategory(jobCategory) ?? jobCategory;
  return getWorkerFeedCategories(profile).includes(jobSlug);
};

export const canWorkerSeeJobCategory = (
  profile: WorkerCategoryProfile | null | undefined,
  jobCategory: JobCategory,
): boolean => workerCoversJobCategory(profile, jobCategory);
