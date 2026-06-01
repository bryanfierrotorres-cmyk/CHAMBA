import { supabase } from '@services/supabase';
import {
  CHAMBA_CATEGORIES,
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  SUGGESTED_PRICES_FALLBACK,
  type JobCategory,
} from '@constants/chambaCategories';
import { getLocalCatalog, saveLocalCatalog, SEED_CATALOG } from '@utils/localCatalog';
import { withTimeout } from '@utils/withTimeout';
import type { ServiceCatalog, ServiceCategory, ServiceType } from '../types';

const REMOTE_TIMEOUT_MS = 8_000;

export const FALLBACK_CATALOG: ServiceCatalog = SEED_CATALOG;

/** Asegura las 8 categorías oficiales + cualquier tipo extra en BD (evita solo 2 en piloto). */
const mergeCatalogWithFallback = (catalog: ServiceCatalog): ServiceCatalog => {
  const remoteBySlug = new Map(catalog.serviceTypes.map((t) => [t.slug, t]));

  const merged: ServiceType[] = CHAMBA_CATEGORIES.map((c, i) => {
    const remote = remoteBySlug.get(c.id);
    if (remote) return remote;

    const categorySlug =
      c.id.startsWith('vehiculo') ? 'vehiculos'
      : c.id.startsWith('conserjeria') || c.id === 'jardineria' ? 'hogar'
      : 'limpieza';

    return {
      id: `fallback-${c.id}`,
      category_id: '',
      category_slug: categorySlug,
      slug: c.id,
      name: c.label,
      description: null,
      icon: c.emoji,
      image_url: null,
      suggested_price: SUGGESTED_PRICES_FALLBACK[c.id as JobCategory] ?? 1000,
      min_price_ratio: 0.5,
      sort_order: i,
    };
  });

  for (const t of catalog.serviceTypes) {
    if (!merged.some((m) => m.slug === t.slug)) merged.push(t);
  }

  merged.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return {
    categories: catalog.categories.length > 0 ? catalog.categories : FALLBACK_CATALOG.categories,
    serviceTypes: merged,
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

  for (const id of Object.keys(CATEGORY_LABELS)) {
    const key = id as JobCategory;
    if (!labelBySlug.has(key)) labelBySlug.set(key, CATEGORY_LABELS[key]);
    if (!emojiBySlug.has(key)) emojiBySlug.set(key, CATEGORY_EMOJIS[key]);
    if (!priceBySlug.has(key)) priceBySlug.set(key, SUGGESTED_PRICES_FALLBACK[key]);
  }

  return { typeBySlug, labelBySlug, emojiBySlug, priceBySlug, minRatioBySlug };
};
