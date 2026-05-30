import type { JobCategory } from '@constants/chambaCategories';
import { CHAMBA_CATEGORY_IDS, fromDbJobCategory } from '@constants/chambaCategories';
import { CONFIG } from '@constants/config';
import type { UserProfile } from '@/types';

type WorkerCategoryProfile = Pick<
  UserProfile,
  'is_approved' | 'category_1' | 'category_2' | 'category_1_approved' | 'category_2_approved'
>;

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

  // Piloto / técnico aprobado sin especialidades: ver todas las categorías
  if (cats.length === 0 && CONFIG.pilot.enabled) {
    return [...CHAMBA_CATEGORY_IDS];
  }

  return cats;
};

export const canWorkerSeeJobCategory = (
  profile: WorkerCategoryProfile | null | undefined,
  jobCategory: JobCategory,
): boolean => getWorkerApprovedCategories(profile).includes(jobCategory);
