import type { JobCategory } from '@constants/chambaCategories';
import { fromDbJobCategory } from '@constants/chambaCategories';
import {
  EXPRESS_MAIN_TILES,
  EXPRESS_SUB_TILES,
  EXPRESS_SUBMENU_META,
} from '@constants/clientHomeExpress';
import type { ExpressSubmenu } from '@constants/servicesConfig';
import { ALL_CONFIGURED_SERVICE_SLUGS, CONFIGURED_SERVICE_SEEDS } from '@constants/servicesConfig';
import { CONFIG } from '@constants/config';
import type { UserProfile } from '@/types';

type WorkerCategoryProfile = Pick<
  UserProfile,
  'is_approved' | 'category_1' | 'category_2' | 'category_1_approved' | 'category_2_approved'
>;

/** Slugs legacy → submenú Express equivalente. */
const LEGACY_SPECIALTY_TO_SUBMENU: Partial<Record<string, ExpressSubmenu>> = {
  vehiculo_profundo: 'vehiculos',
  vehiculo_exterior: 'vehiculos',
  vehiculo_interior: 'vehiculos',
  vehiculo_detallado: 'vehiculos',
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
  const normalized = fromDbJobCategory(slug) ?? slug;
  for (const [menu, tiles] of Object.entries(EXPRESS_SUB_TILES) as [ExpressSubmenu, typeof EXPRESS_SUB_TILES.limpieza][]) {
    if (tiles.some((t) => t.slug === normalized || t.id === normalized)) return menu;
  }
  return LEGACY_SPECIALTY_TO_SUBMENU[normalized] ?? null;
};

const appendCatalogByCategorySlug = (out: Set<string>, categorySlug: string) => {
  for (const seed of CONFIGURED_SERVICE_SEEDS) {
    if (seed.categorySlug === categorySlug) out.add(seed.slug);
  }
};

const appendCatalogBySubcategorySlug = (out: Set<string>, subcategorySlug: string) => {
  for (const seed of CONFIGURED_SERVICE_SEEDS) {
    if (seed.subcategorySlug === subcategorySlug) out.add(seed.slug);
  }
};

const appendCatalogSlugPrefix = (out: Set<string>, prefix: string) => {
  for (const seed of CONFIGURED_SERVICE_SEEDS) {
    if (seed.slug === prefix || seed.slug.startsWith(`${prefix}_`)) out.add(seed.slug);
  }
};

/**
 * Todos los slugs de servicio incluidos al postular/aprobar una especialidad
 * (categoría principal Express + sus sub-servicios).
 */
export const getWorkerCategoryFamily = (slug: string | null | undefined): JobCategory[] => {
  if (!slug) return [];

  const normalized = fromDbJobCategory(slug) ?? slug;
  const out = new Set<string>([normalized]);

  const enrichSubmenuFamily = (menu: ExpressSubmenu) => {
    collectSubmenuSlugs(menu).forEach((s) => out.add(s));
    if (menu === 'limpieza') appendCatalogByCategorySlug(out, 'limpieza');
    if (menu === 'ac') appendCatalogBySubcategorySlug(out, 'ac');
    if (menu === 'jardineria') appendCatalogBySubcategorySlug(out, 'jardineria');
    if (menu === 'vehiculos') appendCatalogByCategorySlug(out, 'vehiculos');
    if (menu === 'mascotas') appendCatalogByCategorySlug(out, 'mascotas');
  };

  const mainTile = EXPRESS_MAIN_TILES.find((t) => t.id === normalized || t.slug === normalized);
  if (mainTile?.submenu) {
    enrichSubmenuFamily(mainTile.submenu);
    return [...out] as JobCategory[];
  }

  const submenu = findSubmenuForSlug(normalized);
  if (submenu) {
    enrichSubmenuFamily(submenu);
    return [...out] as JobCategory[];
  }

  const seed = CONFIGURED_SERVICE_SEEDS.find((s) => s.slug === normalized);
  if (seed?.categorySlug) {
    appendCatalogByCategorySlug(out, seed.categorySlug);
    if (seed.subcategorySlug) appendCatalogBySubcategorySlug(out, seed.subcategorySlug);
  }

  if (normalized.includes('_')) {
    const prefix = normalized.split('_')[0];
    for (const s of ALL_CONFIGURED_SERVICE_SLUGS) {
      if (s === prefix || s.startsWith(`${prefix}_`)) out.add(s);
    }
  }

  if (normalized === 'jardineria' || normalized.startsWith('jardineria_')) {
    appendCatalogBySubcategorySlug(out, 'jardineria');
    collectSubmenuSlugs('jardineria').forEach((s) => out.add(s));
  }

  if (normalized.startsWith('ac_')) {
    appendCatalogBySubcategorySlug(out, 'ac');
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
