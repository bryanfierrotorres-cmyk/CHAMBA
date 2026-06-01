import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCatalog, buildCatalogLookups, FALLBACK_CATALOG } from '../services/catalogService';
import type { ServiceType } from '../types';

export const CATALOG_QUERY_KEY = ['service-catalog'] as const;

export const useCatalog = () => {
  const query = useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: fetchCatalog,
    placeholderData: FALLBACK_CATALOG,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  const lookups = useMemo(
    () => buildCatalogLookups(query.data ?? { categories: [], serviceTypes: [] }),
    [query.data],
  );

  const typesByCategory = useMemo(() => {
    const map = new Map<string, import('../types').ServiceType[]>();
    const types = query.data?.serviceTypes ?? [];
    for (const cat of query.data?.categories ?? []) {
      map.set(
        cat.slug,
        types.filter((t: ServiceType) => t.category_slug === cat.slug || t.category_id === cat.id),
      );
    }
    return map;
  }, [query.data]);

  return {
    ...query,
    catalog: query.data,
    categories: query.data?.categories ?? [],
    serviceTypes: query.data?.serviceTypes ?? [],
    typesByCategory,
    ...lookups,
    getLabel: (slug: string) => lookups.labelBySlug.get(slug) ?? slug,
    getEmoji: (slug: string) => lookups.emojiBySlug.get(slug) ?? '📋',
    getSuggestedPrice: (slug: string) => lookups.priceBySlug.get(slug) ?? 1000,
    getMinPrice: (slug: string) => {
      const suggested = lookups.priceBySlug.get(slug) ?? 1000;
      const ratio = lookups.minRatioBySlug.get(slug) ?? 0.5;
      return Math.ceil(suggested * ratio);
    },
  };
};
