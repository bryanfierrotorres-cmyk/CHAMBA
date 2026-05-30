/** Misma lógica que src/utils/workerCategoryAccess.ts — para pruebas Node E2E */

export const CHAMBA_CATEGORY_IDS = [
  'limpieza_sofas',
  'limpieza_alfombra',
  'alfombra_institucional',
  'fumigacion',
  'vehiculo_profundo',
  'conserjeria_ocasional',
  'conserjeria_contrato',
  'jardineria',
];

export function getWorkerApprovedCategories(profile) {
  if (!profile?.is_approved) return [];

  const cats = [];
  if (profile.category_1 && profile.category_1_approved) {
    cats.push(profile.category_1);
  }
  if (profile.category_2 && profile.category_2_approved) {
    cats.push(profile.category_2);
  }
  return cats;
}

export function canWorkerSeeJobCategory(profile, jobCategory) {
  return getWorkerApprovedCategories(profile).includes(jobCategory);
}
