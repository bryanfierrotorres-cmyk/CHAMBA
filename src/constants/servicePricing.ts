import type { JobCategory } from '@/types';

/** Mínimo permitido respecto al precio sugerido (70% — modelo inDrive). */
export const MIN_PRICE_RATIO = 0.7;

export type PriceLookup = {
  getSuggestedPrice?: (slug: string) => number;
  getMinPrice?: (slug: string) => number;
};

export const getSuggestedPrice = (
  category: JobCategory,
  lookup?: PriceLookup,
): number => {
  const fromLookup = lookup?.getSuggestedPrice?.(category);
  if (fromLookup != null && fromLookup > 0) return fromLookup;
  return 0;
};

export const getMinimumPrice = (
  category: JobCategory,
  lookup?: PriceLookup,
): number => {
  const fromMin = lookup?.getMinPrice?.(category);
  if (fromMin != null && fromMin > 0) return fromMin;
  const suggested = getSuggestedPrice(category, lookup);
  if (suggested <= 0) return 0;
  return Math.ceil(suggested * MIN_PRICE_RATIO);
};

export const validateClientPrice = (
  category: JobCategory,
  amount: number,
  lookup?: PriceLookup,
): { valid: boolean; message: string } => {
  const suggested = getSuggestedPrice(category, lookup);
  const minimum = getMinimumPrice(category, lookup);

  if (suggested <= 0 || minimum <= 0) {
    return {
      valid: false,
      message: 'No se pudo cargar el precio sugerido del servicio. Reintentá en unos segundos.',
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, message: 'Ingresa un presupuesto válido' };
  }

  if (amount < minimum) {
    return {
      valid: false,
      message: `El presupuesto mínimo es C$${minimum.toLocaleString('es-NI')} (70% del precio sugerido de C$${suggested.toLocaleString('es-NI')})`,
    };
  }

  return { valid: true, message: '' };
};
