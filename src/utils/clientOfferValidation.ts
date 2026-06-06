/** Oferta mínima del cliente respecto al precio sugerido (modelo inDrive). */
export const CLIENT_OFFER_MIN_RATIO = 0.7;

export const getClientMinimumOffer = (suggestedPrice: number): number =>
  Math.ceil(Math.max(0, suggestedPrice) * CLIENT_OFFER_MIN_RATIO);

export const parseOfferAmountInput = (text: string): number => {
  const cleaned = text.replace(/[^\d.]/g, '');
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const validateClientOfferAmount = (
  amount: number,
  suggestedPrice: number,
): { valid: boolean; message: string; minimum: number } => {
  const minimum = getClientMinimumOffer(suggestedPrice);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      message: 'Ingresá un monto válido mayor a cero',
      minimum,
    };
  }

  if (amount < minimum) {
    return {
      valid: false,
      message: `El monto mínimo aceptable es C$${minimum.toLocaleString('es-NI')} (70% del precio sugerido)`,
      minimum,
    };
  }

  return { valid: true, message: '', minimum };
};
