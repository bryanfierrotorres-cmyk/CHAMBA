import {
  SUGGESTED_PRICES_FALLBACK,
  type JobCategory,
} from '@constants/chambaCategories';

/** Mínimo permitido respecto al precio sugerido (70% — modelo inDrive). */
export const MIN_PRICE_RATIO = 0.7;

export type PriceLookup = {
  getSuggestedPrice?: (slug: string) => number;
  getMinPrice?: (slug: string) => number;
};

export const getSuggestedPrice = (
  category: JobCategory,
  lookup?: PriceLookup,
): number =>
  lookup?.getSuggestedPrice?.(category)
  ?? SUGGESTED_PRICES_FALLBACK[category]
  ?? 1000;

export const getMinimumPrice = (
  category: JobCategory,
  lookup?: PriceLookup,
): number =>
  lookup?.getMinPrice?.(category)
  ?? Math.ceil(getSuggestedPrice(category, lookup) * MIN_PRICE_RATIO);

export const validateClientPrice = (
  category: JobCategory,
  amount: number,
  lookup?: PriceLookup,
): { valid: boolean; message: string } => {
  const suggested = getSuggestedPrice(category, lookup);
  const minimum = getMinimumPrice(category, lookup);

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
