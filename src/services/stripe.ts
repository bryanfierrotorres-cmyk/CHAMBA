import { initStripe, confirmPayment } from '@stripe/stripe-react-native';
import { CONFIG } from '@constants/config';
import { supabase } from './supabase';
import type { PaymentSummary } from '@/types';

export const initializeStripe = async () => {
  await initStripe({
    publishableKey: CONFIG.stripe.publishableKey,
    merchantIdentifier: 'merchant.com.chamba.app',
    urlScheme: 'chamba',
  });
};

/**
 * Crea un PaymentIntent en Supabase Edge Function y retorna el client_secret.
 * En modo Test, usa stripe en modo simulado.
 */
export const createPaymentIntent = async (
  jobId: string,
  amount: number,
): Promise<{ clientSecret: string; paymentIntentId: string } | null> => {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { job_id: jobId, amount_cents: Math.round(amount * 100) },
  });

  if (error || !data) {
    console.error('[Stripe] Error creating payment intent:', error);
    return null;
  }

  return { clientSecret: data.client_secret, paymentIntentId: data.payment_intent_id };
};

/**
 * Calcula el desglose de un pago dado el monto bruto.
 */
export const calculatePaymentBreakdown = (grossAmount: number): PaymentSummary => {
  const platformFee = parseFloat((grossAmount * CONFIG.platform.commissionRate).toFixed(2));
  const workerPayout = parseFloat((grossAmount * CONFIG.platform.workerPayoutRate).toFixed(2));

  return {
    job_id: '',
    pay_amount: grossAmount,
    platform_fee: platformFee,
    worker_payout: workerPayout,
    payment_intent_id: null,
    status: 'pending',
  };
};

/**
 * Confirma el pago usando Stripe React Native SDK.
 */
export const confirmJobPayment = async (clientSecret: string) => {
  const { error, paymentIntent } = await confirmPayment(clientSecret, {
    paymentMethodType: 'Card',
  });

  if (error) {
    console.error('[Stripe] Payment confirmation error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, paymentIntent };
};
