import { supabase } from '@services/supabase';
import {
  CONFIGURED_SERVICE_SEEDS,
  SERVICE_FALLBACK_PRICES,
} from '@constants/servicesConfig';
import { withTimeout } from '@utils/withTimeout';

const REMOTE_TIMEOUT_MS = 8_000;

export const PRECIOS_CATALOG_QUERY_KEY = ['precios-catalogo'] as const;

export type PreciosCatalogSource = 'database' | 'fallback';

export interface PrecioCatalogoRow {
  service_slug: string;
  suggested_price: number;
  min_price_ratio: number;
  updated_at?: string;
}

export interface PrecioCatalogoEntry {
  suggestedPrice: number;
  minPriceRatio: number;
}

export type PreciosCatalogoMap = Map<string, PrecioCatalogoEntry>;

export interface FetchPreciosCatalogoResult {
  rows: PrecioCatalogoRow[];
  source: PreciosCatalogSource;
  dbRowCount: number;
}

/** Mapa local completo desde servicesConfig (nunca vacío). */
export const buildFallbackPreciosMap = (): PreciosCatalogoMap => {
  const map = new Map<string, PrecioCatalogoEntry>();

  for (const def of CONFIGURED_SERVICE_SEEDS) {
    map.set(def.slug, {
      suggestedPrice: def.suggestedPrice,
      minPriceRatio: 0.5,
    });
  }

  for (const [slug, price] of Object.entries(SERVICE_FALLBACK_PRICES)) {
    if (!map.has(slug)) {
      map.set(slug, { suggestedPrice: price, minPriceRatio: 0.5 });
    }
  }

  return map;
};

export const FALLBACK_PRECIOS_MAP = buildFallbackPreciosMap();

const parsePreciosRows = (raw: unknown): PrecioCatalogoRow[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const slug = String(row.service_slug ?? '').trim().toLowerCase();
      const price = Number(row.suggested_price);
      const ratio = Number(row.min_price_ratio);
      if (!slug || !Number.isFinite(price) || price < 0) return null;
      return {
        service_slug: slug,
        suggested_price: price,
        min_price_ratio: Number.isFinite(ratio) && ratio > 0 && ratio <= 1 ? ratio : 0.5,
        updated_at: row.updated_at ? String(row.updated_at) : undefined,
      } satisfies PrecioCatalogoRow;
    })
    .filter((row): row is PrecioCatalogoRow => row !== null);
};

export const mapPreciosRowsToMap = (rows: PrecioCatalogoRow[]): PreciosCatalogoMap => {
  const map = new Map<string, PrecioCatalogoEntry>();
  for (const row of rows) {
    map.set(row.service_slug, {
      suggestedPrice: row.suggested_price,
      minPriceRatio: row.min_price_ratio,
    });
  }
  return map;
};

/**
 * Resuelve precio final: DB > catálogo remoto > seeds locales.
 * Nunca retorna null/undefined; mínimo 0 con fallback en cadena.
 */
export const resolveSuggestedPrice = (
  slug: string,
  dbPrecios?: PreciosCatalogoMap | null,
  catalogPrice?: number | null,
): number => {
  const normalized = slug.trim().toLowerCase();
  const fromDb = dbPrecios?.get(normalized)?.suggestedPrice;
  if (fromDb != null && fromDb >= 0) return fromDb;

  if (catalogPrice != null && catalogPrice > 0) return catalogPrice;

  const fromSeed = FALLBACK_PRECIOS_MAP.get(normalized)?.suggestedPrice;
  if (fromSeed != null && fromSeed >= 0) return fromSeed;

  const fromFallback = SERVICE_FALLBACK_PRICES[normalized];
  if (fromFallback != null && fromFallback >= 0) return fromFallback;

  return 1000;
};

export const resolveMinPriceRatio = (
  slug: string,
  dbPrecios?: PreciosCatalogoMap | null,
  catalogRatio?: number | null,
): number => {
  const normalized = slug.trim().toLowerCase();
  const fromDb = dbPrecios?.get(normalized)?.minPriceRatio;
  if (fromDb != null && fromDb > 0 && fromDb <= 1) return fromDb;
  if (catalogRatio != null && catalogRatio > 0 && catalogRatio <= 1) return catalogRatio;
  return 0.5;
};

const isRpcMissing = (error: { code?: string; message?: string }): boolean =>
  error.code === 'PGRST202'
  || Boolean(error.message?.includes('get_precios_catalogo'));

/** Un fetch al RPC; tabla vacía o error → source fallback (seeds locales). */
export const fetchPreciosCatalogo = async (): Promise<FetchPreciosCatalogoResult> => {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('get_precios_catalogo'),
      REMOTE_TIMEOUT_MS,
    );

    if (error) {
      if (isRpcMissing(error)) {
        console.warn('[precios-catalogo] RPC no disponible — usando fallback local');
        return { rows: [], source: 'fallback', dbRowCount: 0 };
      }
      throw error;
    }

    const rows = parsePreciosRows(data);
    if (rows.length === 0) {
      return { rows: [], source: 'fallback', dbRowCount: 0 };
    }

    return { rows, source: 'database', dbRowCount: rows.length };
  } catch (err) {
    console.warn('[precios-catalogo] fetch falló — usando fallback local:', err);
    return { rows: [], source: 'fallback', dbRowCount: 0 };
  }
};

export interface AdminPrecioUpsertRow {
  service_slug: string;
  suggested_price: number;
  min_price_ratio?: number;
}

/** Escritura batch (Fase C admin UI); incluye validación admin en RPC. */
export const adminUpsertPreciosBatch = async (
  adminId: string,
  rows: AdminPrecioUpsertRow[],
): Promise<{ success: boolean; updated?: number; error?: string }> => {
  const payload = rows.map((row) => ({
    service_slug: row.service_slug.trim().toLowerCase(),
    suggested_price: row.suggested_price,
    min_price_ratio: row.min_price_ratio ?? 0.5,
  }));

  const { data, error } = await supabase.rpc('admin_upsert_precios_batch', {
    p_admin_id: adminId,
    p_rows: payload,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as { success?: boolean; updated?: number; error?: string } | null;
  if (!result?.success) {
    return { success: false, error: result?.error ?? 'Error desconocido' };
  }

  return { success: true, updated: result.updated };
};
