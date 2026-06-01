/**
 * Stub web para @stripe/stripe-react-native (solo nativo).
 */
export const initStripe = async (_options: Record<string, unknown>) => {};

export const confirmPayment = async (
  _clientSecret: string,
  _params: { paymentMethodType: string },
) => ({
  error: { message: 'Stripe nativo no disponible en web' },
  paymentIntent: null,
});
