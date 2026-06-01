import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServiceCatalog, ServiceCategory, ServiceType } from '@features/catalog/types';

const STORAGE_KEY = 'CHAMBA_SERVICE_CATALOG_V1';

/** Semilla idéntica a migración 010_part2_seed.sql */
export const SEED_CATALOG: ServiceCatalog = {
  categories: [
    { id: 'seed-limpieza', slug: 'limpieza', name: 'Limpieza', icon: '✨', image_url: null, sort_order: 1 },
    { id: 'seed-vehiculos', slug: 'vehiculos', name: 'Vehículos', icon: '🚗', image_url: null, sort_order: 2 },
    { id: 'seed-hogar', slug: 'hogar', name: 'Hogar', icon: '🏠', image_url: null, sort_order: 3 },
  ],
  serviceTypes: [
    { id: 'seed-limpieza_sofas', category_id: 'seed-limpieza', category_slug: 'limpieza', slug: 'limpieza_sofas', name: 'Limpieza de Sofás', description: 'Tapicería, cuero y tela', icon: '🛋️', image_url: null, suggested_price: 1400, min_price_ratio: 0.5, sort_order: 1 },
    { id: 'seed-limpieza_alfombra', category_id: 'seed-limpieza', category_slug: 'limpieza', slug: 'limpieza_alfombra', name: 'Limpieza de Alfombra', description: 'Residencial profunda', icon: '🏠', image_url: null, suggested_price: 950, min_price_ratio: 0.5, sort_order: 2 },
    { id: 'seed-alfombra_institucional', category_id: 'seed-limpieza', category_slug: 'limpieza', slug: 'alfombra_institucional', name: 'Limpieza de Alfombra Institucional', description: 'Oficinas y centros comerciales', icon: '🏢', image_url: null, suggested_price: 1800, min_price_ratio: 0.5, sort_order: 3 },
    { id: 'seed-fumigacion', category_id: 'seed-limpieza', category_slug: 'limpieza', slug: 'fumigacion', name: 'Fumigación', description: 'Control de plagas certificado', icon: '🪲', image_url: null, suggested_price: 1200, min_price_ratio: 0.5, sort_order: 4 },
    { id: 'seed-vehiculo_profundo', category_id: 'seed-vehiculos', category_slug: 'vehiculos', slug: 'vehiculo_profundo', name: 'Limpieza Profunda de Vehículo', description: 'Interior y exterior', icon: '🚗', image_url: null, suggested_price: 900, min_price_ratio: 0.5, sort_order: 1 },
    { id: 'seed-conserjeria_ocasional', category_id: 'seed-hogar', category_slug: 'hogar', slug: 'conserjeria_ocasional', name: 'Conserjería Ocasional', description: 'Limpieza puntual por evento', icon: '⏰', image_url: null, suggested_price: 850, min_price_ratio: 0.5, sort_order: 1 },
    { id: 'seed-conserjeria_contrato', category_id: 'seed-hogar', category_slug: 'hogar', slug: 'conserjeria_contrato', name: 'Conserjería por Contrato', description: 'Servicio mensual fijo', icon: '📋', image_url: null, suggested_price: 2500, min_price_ratio: 0.5, sort_order: 2 },
    { id: 'seed-jardineria', category_id: 'seed-hogar', category_slug: 'hogar', slug: 'jardineria', name: 'Jardinería', description: 'Poda, riego y mantenimiento', icon: '🌿', image_url: null, suggested_price: 1000, min_price_ratio: 0.5, sort_order: 3 },
  ],
};

const readStored = async (): Promise<ServiceCatalog | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ServiceCatalog;
    if (!parsed?.categories?.length && !parsed?.serviceTypes?.length) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const getLocalCatalog = async (): Promise<ServiceCatalog> => {
  const stored = await readStored();
  return stored ?? SEED_CATALOG;
};

export const saveLocalCatalog = async (catalog: ServiceCatalog): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
};

export const upsertLocalCategory = async (params: {
  slug: string;
  name: string;
  icon: string;
  imageUrl?: string | null;
}): Promise<ServiceCatalog> => {
  const catalog = await getLocalCatalog();
  const slug = params.slug.toLowerCase().trim();
  const existing = catalog.categories.find((c) => c.slug === slug);

  const category: ServiceCategory = existing
    ? { ...existing, name: params.name.trim(), icon: params.icon.trim() || '📋', image_url: params.imageUrl ?? existing.image_url }
    : {
        id: `local-${slug}`,
        slug,
        name: params.name.trim(),
        icon: params.icon.trim() || '📋',
        image_url: params.imageUrl ?? null,
        sort_order: catalog.categories.length + 1,
      };

  const categories = existing
    ? catalog.categories.map((c) => (c.slug === slug ? category : c))
    : [...catalog.categories, category];

  const next = { ...catalog, categories };
  await saveLocalCatalog(next);
  return next;
};

export const upsertLocalServiceType = async (params: {
  categorySlug: string;
  slug: string;
  name: string;
  icon: string;
  description?: string | null;
  suggestedPrice: number;
  imageUrl?: string | null;
}): Promise<ServiceCatalog> => {
  const catalog = await getLocalCatalog();
  const category = catalog.categories.find((c) => c.slug === params.categorySlug.toLowerCase().trim());
  if (!category) throw new Error('Categoría no encontrada');

  const slug = params.slug.toLowerCase().trim();
  const existing = catalog.serviceTypes.find((t) => t.slug === slug);

  const serviceType: ServiceType = existing
    ? {
        ...existing,
        name: params.name.trim(),
        icon: params.icon.trim() || '🔧',
        description: params.description ?? existing.description,
        suggested_price: Math.max(params.suggestedPrice, 0),
        image_url: params.imageUrl ?? existing.image_url,
      }
    : {
        id: `local-${slug}`,
        category_id: category.id,
        category_slug: category.slug,
        slug,
        name: params.name.trim(),
        description: params.description ?? null,
        icon: params.icon.trim() || '🔧',
        image_url: params.imageUrl ?? null,
        suggested_price: Math.max(params.suggestedPrice, 0),
        min_price_ratio: 0.5,
        sort_order: catalog.serviceTypes.filter((t) => t.category_slug === category.slug).length + 1,
      };

  const serviceTypes = existing
    ? catalog.serviceTypes.map((t) => (t.slug === slug ? serviceType : t))
    : [...catalog.serviceTypes, serviceType];

  const next = { ...catalog, serviceTypes };
  await saveLocalCatalog(next);
  return next;
};
