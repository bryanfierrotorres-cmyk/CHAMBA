/**
 * Precio sugerido para validar oferta del cliente (70%).
 * Solo precios_catalogo / BD — sin seeds estáticos (1400).
 */
import type { PreciosCatalogoMap } from '@features/catalog/services/preciosCatalogService';

export const resolveOfferSuggestedPriceFromDb = (
  slug: string,
  dbPrecios: PreciosCatalogoMap,
): number | null => {
  const normalized = slug.trim().toLowerCase();
  const fromDb = dbPrecios.get(normalized)?.suggestedPrice;
  if (fromDb != null && Number.isFinite(fromDb) && fromDb > 0) {
    return fromDb;
  }
  return null;
};
