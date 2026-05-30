import type { JobCategory } from '@constants/chambaCategories';

/** Mínimo permitido respecto al precio sugerido (50%). */
export const MIN_PRICE_RATIO = 0.5;

/**
 * Precios sugeridos en córdobas (C$) por categoría de servicio.
 * Son referencia para el cliente; puede ofrecer más, no menos del 50%.
 */
export const SUGGESTED_PRICES: Record<JobCategory, number> = {
  limpieza_sofas:          1400,
  limpieza_alfombra:       950,
  alfombra_institucional:  1800,
  fumigacion:              1200,
  vehiculo_profundo:       900,
  conserjeria_ocasional:   850,
  conserjeria_contrato:    2500,
  jardineria:              1000,
};

export const getSuggestedPrice = (category: JobCategory): number =>
  SUGGESTED_PRICES[category];

export const getMinimumPrice = (category: JobCategory): number =>
  Math.ceil(getSuggestedPrice(category) * MIN_PRICE_RATIO);

export const validateClientPrice = (
  category: JobCategory,
  amount: number,
): { valid: boolean; message: string } => {
  const suggested = getSuggestedPrice(category);
  const minimum = getMinimumPrice(category);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, message: 'Ingresa un presupuesto válido' };
  }

  if (amount < minimum) {
    return {
      valid: false,
      message: `El presupuesto mínimo es C$${minimum.toLocaleString('es-NI')} (50% del precio sugerido de C$${suggested.toLocaleString('es-NI')})`,
    };
  }

  return { valid: true, message: '' };
};
