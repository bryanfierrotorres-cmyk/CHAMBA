import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchCatalog,
  buildCatalogLookups,
  applyPreciosToCatalog,
  FALLBACK_CATALOG,
} from '../services/catalogService';
import { resolveSuggestedPrice } from '../services/preciosCatalogService';
import { usePreciosCatalog } from './usePreciosCatalog';
import type { ServiceType } from '../types';

export const CATALOG_QUERY_KEY = ['service-catalog'] as const;

export const useCatalog = () => {
  const precios = usePreciosCatalog();

  const query = useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: fetchCatalog,
    placeholderData: FALLBACK_CATALOG,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  const catalogWithPrecios = useMemo(
    () => applyPreciosToCatalog(
      query.data ?? FALLBACK_CATALOG,
      precios.dbPreciosMap,
    ),
    [query.data, precios.dbPreciosMap],
  );

  const lookups = useMemo(
    () => buildCatalogLookups(catalogWithPrecios, precios.dbPreciosMap),
    [catalogWithPrecios, precios.dbPreciosMap],
  );

  const typesByCategory = useMemo(() => {
    const map = new Map<string, import('../types').ServiceType[]>();
    const types = catalogWithPrecios.serviceTypes ?? [];
    for (const cat of catalogWithPrecios.categories ?? []) {
      map.set(
        cat.slug,
        types.filter((t: ServiceType) => t.category_slug === cat.slug || t.category_id === cat.id),
      );
    }
    return map;
  }, [catalogWithPrecios]);

  return {
    ...query,
    catalog: catalogWithPrecios,
    categories: catalogWithPrecios.categories ?? [],
    serviceTypes: catalogWithPrecios.serviceTypes ?? [],
    typesByCategory,
    preciosSource: precios.source,
    preciosDbRowCount: precios.dbRowCount,
    ...lookups,
    getLabel: (slug: string) => lookups.labelBySlug.get(slug) ?? slug,
    getEmoji: (slug: string) => lookups.emojiBySlug.get(slug) ?? '📋',
    getSuggestedPrice: (slug: string) =>
      lookups.priceBySlug.get(slug)
      ?? resolveSuggestedPrice(slug, precios.dbPreciosMap),
    getMinPrice: (slug: string) => {
      const suggested = lookups.priceBySlug.get(slug)
        ?? resolveSuggestedPrice(slug, precios.dbPreciosMap);
      const ratio = lookups.minRatioBySlug.get(slug) ?? 0.5;
      return Math.ceil(suggested * ratio);
    },
  };
};
