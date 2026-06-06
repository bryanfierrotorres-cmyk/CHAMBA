import { useEffect, useRef } from 'react';
import {
  SERVICE_FALLBACK_PRICES,
  CONFIGURED_SERVICE_SEEDS,
} from '@constants/servicesConfig';
import { usePreciosCatalog } from './usePreciosCatalog';

/** Slugs de prueba: uno común + uno con precio distintivo en seeds. */
const PROBE_SLUGS = ['conserjeria_ocasional', 'mandados_express'] as const;

/**
 * Hook de diagnóstico (__DEV__): confirma fallback con tabla vacía
 * y transición a precio DB tras el primer insert manual.
 */
export const usePreciosCatalogProbe = () => {
  const {
    source,
    dbRowCount,
    dbPreciosMap,
    isUsingFallback,
    isFetched,
    isLoading,
    getSuggestedPrice,
  } = usePreciosCatalog();

  const lastSignature = useRef<string>('');

  useEffect(() => {
    if (!__DEV__ || !isFetched || isLoading) return;

    const samples = PROBE_SLUGS.map((slug) => {
      const seed = CONFIGURED_SERVICE_SEEDS.find((s) => s.slug === slug);
      const fallbackPrice = SERVICE_FALLBACK_PRICES[slug] ?? seed?.suggestedPrice ?? null;
      const dbEntry = dbPreciosMap.get(slug);
      const resolved = getSuggestedPrice(slug);

      return {
        slug,
        fallbackPrice,
        dbPrice: dbEntry?.suggestedPrice ?? null,
        resolvedPrice: resolved,
        fromDatabase: dbEntry != null,
      };
    });

    const signature = `${source}|${dbRowCount}|${samples.map((s) => `${s.slug}:${s.resolvedPrice}:${s.fromDatabase}`).join('|')}`;
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

    console.group('[CHAMBA Precios Probe]');
    console.log('Estado:', {
      source,
      dbRowCount,
      isUsingFallback,
      mensaje: isUsingFallback
        ? 'Tabla vacía o RPC no disponible → precios desde servicesConfig.ts'
        : 'Hay filas en precios_catalogo → overlay DB por slug',
    });
    console.table(samples);
    console.log(
      'Prueba manual Supabase:',
      "INSERT INTO precios_catalogo (service_slug, suggested_price) VALUES ('conserjeria_ocasional', 9999);",
      '→ recargar app y ver resolvedPrice=9999 para ese slug.',
    );
    console.groupEnd();
  }, [
    source,
    dbRowCount,
    dbPreciosMap,
    isUsingFallback,
    isFetched,
    isLoading,
    getSuggestedPrice,
  ]);
};
