import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildSeedCatalog } from '@constants/servicesConfig';
import type { ServiceCatalog, ServiceCategory, ServiceType } from '@features/catalog/types';

const STORAGE_KEY = 'CHAMBA_SERVICE_CATALOG_V1';

/** Semilla alineada con servicesConfig.ts y migración 011. */
export const SEED_CATALOG: ServiceCatalog = buildSeedCatalog();

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
