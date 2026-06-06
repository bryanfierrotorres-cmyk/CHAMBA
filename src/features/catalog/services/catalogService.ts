import { supabase } from '@services/supabase';
import {
  CONFIGURED_SERVICE_SEEDS,
  CONFIGURED_CATEGORY_SEEDS,
  ALL_CONFIGURED_SERVICE_SLUGS,
  REMOVED_SERVICE_SLUGS,
  getConfiguredServiceLabel,
  SERVICE_FALLBACK_PRICES,
  buildSeedCatalog,
} from '@constants/servicesConfig';
import { getLocalCatalog, saveLocalCatalog } from '@utils/localCatalog';
import { withTimeout } from '@utils/withTimeout';
import type { ServiceCatalog, ServiceCategory, ServiceType } from '../types';

const REMOTE_TIMEOUT_MS = 8_000;

export const FALLBACK_CATALOG: ServiceCatalog = buildSeedCatalog();

/** Asegura el catálogo canónico (servicesConfig) sin slugs retirados. */
const mergeCatalogWithFallback = (catalog: ServiceCatalog): ServiceCatalog => {
  const removed = new Set<string>(REMOVED_SERVICE_SLUGS);
  const allowed = new Set<string>(ALL_CONFIGURED_SERVICE_SLUGS);
  const remoteBySlug = new Map(
    catalog.serviceTypes
      .filter((t) => !removed.has(t.slug))
      .map((t) => [t.slug, t]),
  );

  const merged: ServiceType[] = CONFIGURED_SERVICE_SEEDS.map((def) => {
    const remote = remoteBySlug.get(def.slug);
    if (remote) {
      return {
        ...remote,
        category_slug: def.categorySlug,
        subcategory_slug: def.subcategorySlug ?? null,
        name: remote.name?.trim() ? remote.name : def.label,
        description: remote.description ?? def.description,
        icon: remote.icon ?? def.icon,
        sort_order: def.sortOrder,
      };
    }

    return {
      id: `fallback-${def.slug}`,
      category_id: '',
      category_slug: def.categorySlug,
      subcategory_slug: def.subcategorySlug ?? null,
      slug: def.slug,
      name: def.label,
      description: def.description,
      icon: def.icon,
      image_url: null,
      suggested_price: def.suggestedPrice,
      min_price_ratio: 0.5,
      sort_order: def.sortOrder,
    };
  });

  merged.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const seedCategories = CONFIGURED_CATEGORY_SEEDS.map((c) => ({
    id: `fallback-${c.slug}`,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    image_url: null,
    sort_order: c.sort_order,
  }));

  const remoteCategories = catalog.categories.filter((c) => allowed.has(c.slug) || seedCategories.some((s) => s.slug === c.slug));

  return {
    categories: remoteCategories.length > 0 ? remoteCategories : seedCategories,
    serviceTypes: merged.filter((t) => allowed.has(t.slug)),
  };
};

const parseCatalog = (raw: unknown): ServiceCatalog => {
  const data = raw as {
    categories?: ServiceCategory[];
    service_types?: ServiceType[];
    serviceTypes?: ServiceType[];
  } | null;

  const categories = (data?.categories ?? []) as ServiceCategory[];
  const serviceTypes = (data?.service_types ?? data?.serviceTypes ?? []) as ServiceType[];

  if (categories.length === 0 && serviceTypes.length === 0) {
    return FALLBACK_CATALOG;
  }

  return mergeCatalogWithFallback({ categories, serviceTypes });
};

const isRemoteUnavailable = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('522')
    || msg.includes('timed out')
    || msg.includes('Timeout')
    || msg.includes('fetch failed')
    || msg.includes('Failed to fetch')
    || msg.includes('Network')
    || msg.includes('<!DOCTYPE html>')
    || msg.includes('Connection timed out')
  );
};

/** Lectura directa (si las tablas existen y RLS permite). */
export const fetchCatalogFromTables = async (): Promise<ServiceCatalog> => {
  const { data: categories, error: catErr } = await withTimeout(
    supabase
      .from('service_categories')
      .select('id, slug, name, icon, image_url, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .order('name'),
    REMOTE_TIMEOUT_MS,
  );

  if (catErr) throw catErr;

  const { data: serviceTypes, error: typeErr } = await withTimeout(
    supabase
      .from('service_types')
      .select(`
        id, category_id, slug, name, description, icon, image_url,
        suggested_price, min_price_ratio, sort_order,
        category:service_categories(slug)
      `)
      .eq('is_active', true)
      .order('sort_order')
      .order('name'),
    REMOTE_TIMEOUT_MS,
  );

  if (typeErr) throw typeErr;

  const types: ServiceType[] = (serviceTypes ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    category_id: row.category_id as string,
    category_slug: (row.category as { slug?: string } | null)?.slug ?? '',
    slug: row.slug as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    icon: (row.icon as string) ?? '🔧',
    image_url: (row.image_url as string) ?? null,
    suggested_price: Number(row.suggested_price) || 0,
    min_price_ratio: Number(row.min_price_ratio) || 0.5,
    sort_order: Number(row.sort_order) || 0,
  }));

  if (types.length === 0) return FALLBACK_CATALOG;

  return mergeCatalogWithFallback({
    categories: (categories ?? []) as ServiceCategory[],
    serviceTypes: types,
  });
};

/** Intenta RPC remoto con timeout; null si no hay catálogo en BD. */
export const fetchCatalogRemote = async (): Promise<ServiceCatalog | null> => {
  const { data, error } = await withTimeout(
    supabase.rpc('get_active_catalog'),
    REMOTE_TIMEOUT_MS,
  );

  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('get_active_catalog')) {
      return null;
    }
    throw error;
  }

  const raw = data as { categories?: unknown[]; service_types?: unknown[] } | null;
  if (!raw?.categories?.length && !raw?.service_types?.length) {
    return null;
  }

  return parseCatalog(data);
};

/** RPC unificado → tablas → caché local → semilla. */
export const fetchCatalog = async (): Promise<ServiceCatalog> => {
  try {
    const remote = await fetchCatalogRemote();
    if (remote) {
      await saveLocalCatalog(remote);
      return remote;
    }

    try {
      const fromTables = await fetchCatalogFromTables();
      await saveLocalCatalog(fromTables);
      return fromTables;
    } catch (tableErr) {
      if (!isRemoteUnavailable(tableErr)) {
        console.warn('[catalog] tablas no disponibles:', tableErr);
      }
    }
  } catch (err) {
    if (!isRemoteUnavailable(err)) {
      console.warn('[catalog] remoto no disponible:', err);
    }
  }

  const local = await getLocalCatalog();
  return mergeCatalogWithFallback(local);
};

export const buildCatalogLookups = (catalog: ServiceCatalog) => {
  const typeBySlug = new Map<string, ServiceType>();
  const labelBySlug = new Map<string, string>();
  const emojiBySlug = new Map<string, string>();
  const priceBySlug = new Map<string, number>();
  const minRatioBySlug = new Map<string, number>();

  for (const t of catalog.serviceTypes) {
    typeBySlug.set(t.slug, t);
    labelBySlug.set(t.slug, t.name);
    emojiBySlug.set(t.slug, t.icon);
    priceBySlug.set(t.slug, t.suggested_price);
    minRatioBySlug.set(t.slug, t.min_price_ratio);
  }

  for (const def of CONFIGURED_SERVICE_SEEDS) {
    if (!labelBySlug.has(def.slug)) labelBySlug.set(def.slug, def.label);
    if (!emojiBySlug.has(def.slug)) emojiBySlug.set(def.slug, def.icon);
    if (!priceBySlug.has(def.slug)) priceBySlug.set(def.slug, def.suggestedPrice);
  }

  for (const [slug, price] of Object.entries(SERVICE_FALLBACK_PRICES)) {
    if (!priceBySlug.has(slug)) priceBySlug.set(slug, price);
  }

  for (const slug of Object.keys(SERVICE_FALLBACK_PRICES)) {
    const label = getConfiguredServiceLabel(slug);
    if (label && !labelBySlug.has(slug)) labelBySlug.set(slug, label);
  }

  return { typeBySlug, labelBySlug, emojiBySlug, priceBySlug, minRatioBySlug };
};
