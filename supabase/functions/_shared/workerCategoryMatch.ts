import type { WorkerProfileRow } from './jobNotifyTypes.ts';

const LEGACY_SLUG_ALIASES: Record<string, string> = {
  vehiculo_profundo: 'vehiculo_limpieza_profunda',
  vehiculo_exterior: 'vehiculo_lavado_regular',
  vehiculo_interior: 'vehiculo_lavado_regular',
  vehiculo_detallado: 'vehiculo_pulido_pasteado',
  pet_care: 'pet_bano',
  sofas: 'limpieza_sofas',
  alfombra: 'limpieza_alfombra',
};

/** Familias Express aproximadas (alineado al feed del técnico en app). */
const MENU_FAMILY: Record<string, readonly string[]> = {
  limpieza: [
    'limpieza_sofas',
    'limpieza_banos',
    'conserjeria_ocasional',
    'limpieza_alfombra',
  ],
  vehiculos: [
    'vehiculo_lavado_regular',
    'vehiculo_limpieza_profunda',
    'vehiculo_aceite_filtro',
    'vehiculo_pulido_pasteado',
  ],
  jardineria: [
    'jardineria_corte',
    'jardineria_poda',
    'jardineria_patio',
    'jardineria',
  ],
  ac: [
    'ac_limpieza_filtros',
    'ac_mantenimiento',
    'ac_revision',
    'ac_recarga',
  ],
  mascotas: ['pet_bano', 'pet_paseo', 'pet_grooming', 'pet_personalizado'],
};

const normalizeSlug = (slug: string | null | undefined): string => {
  if (!slug) return '';
  const trimmed = slug.trim();
  return LEGACY_SLUG_ALIASES[trimmed] ?? trimmed;
};

const expandSpecialty = (specialty: string): Set<string> => {
  const out = new Set<string>([specialty]);

  for (const [menu, slugs] of Object.entries(MENU_FAMILY)) {
    if (slugs.includes(specialty) || specialty === menu) {
      slugs.forEach((s) => out.add(s));
      out.add(menu);
    }
  }

  const root = specialty.split('_')[0];
  if (root.length >= 4) {
    for (const slug of Object.values(MENU_FAMILY).flat()) {
      if (slug.startsWith(`${root}_`) || slug === root) out.add(slug);
    }
  }

  return out;
};

export const workerCoversJobCategory = (
  worker: WorkerProfileRow,
  jobCategory: string,
): boolean => {
  const jobSlug = normalizeSlug(jobCategory);
  if (!jobSlug) return false;

  const specialties: string[] = [];
  if (worker.category_1 && worker.category_1_approved) {
    specialties.push(normalizeSlug(worker.category_1));
  }
  if (worker.category_2 && worker.category_2_approved) {
    specialties.push(normalizeSlug(worker.category_2));
  }

  for (const specialty of specialties) {
    if (specialty === jobSlug) return true;
    if (expandSpecialty(specialty).has(jobSlug)) return true;
  }

  return false;
};
