import { CONFIG } from '@constants/config';
import { supabase } from './supabase';
import type { PaymentSummary } from '@/types';

export const initializeStripe = async () => {
  // SDK nativo omitido en web; pagos vía Edge Functions si aplica.
};

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

export const confirmJobPayment = async (_clientSecret: string) => ({
  success: false,
  error: 'Pagos con tarjeta nativa no están disponibles en web',
});
