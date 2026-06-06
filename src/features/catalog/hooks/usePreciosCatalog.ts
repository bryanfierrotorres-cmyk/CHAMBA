import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchPreciosCatalogo,
  mapPreciosRowsToMap,
  FALLBACK_PRECIOS_MAP,
  PRECIOS_CATALOG_QUERY_KEY,
  resolveSuggestedPrice,
  resolveMinPriceRatio,
  type PreciosCatalogSource,
  type PreciosCatalogoMap,
} from '../services/preciosCatalogService';

const STALE_TIME_MS = 15 * 60_000;
const GC_TIME_MS = 30 * 60_000;

export const usePreciosCatalog = () => {
  const query = useQuery({
    queryKey: PRECIOS_CATALOG_QUERY_KEY,
    queryFn: fetchPreciosCatalogo,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    retry: 1,
    placeholderData: {
      rows: [],
      source: 'fallback' as PreciosCatalogSource,
      dbRowCount: 0,
    },
  });

  const dbPreciosMap = useMemo(
    () => mapPreciosRowsToMap(query.data?.rows ?? []),
    [query.data?.rows],
  );

  /** DB sobrescribe seeds; slugs sin fila conservan fallback local. */
  const effectivePreciosMap: PreciosCatalogoMap = useMemo(() => {
    if (query.data?.source !== 'database' || dbPreciosMap.size === 0) {
      return FALLBACK_PRECIOS_MAP;
    }
    const merged = new Map(FALLBACK_PRECIOS_MAP);
    for (const [slug, entry] of dbPreciosMap) {
      merged.set(slug, entry);
    }
    return merged;
  }, [query.data?.source, dbPreciosMap]);

  return {
    ...query,
    source: query.data?.source ?? ('fallback' as PreciosCatalogSource),
    dbRowCount: query.data?.dbRowCount ?? 0,
    dbPreciosMap,
    effectivePreciosMap,
    isUsingFallback: (query.data?.source ?? 'fallback') === 'fallback',
    getSuggestedPrice: (slug: string, catalogPrice?: number | null) =>
      resolveSuggestedPrice(slug, dbPreciosMap, catalogPrice),
    getMinPriceRatio: (slug: string, catalogRatio?: number | null) =>
      resolveMinPriceRatio(slug, dbPreciosMap, catalogRatio),
  };
};

export { PRECIOS_CATALOG_QUERY_KEY };
