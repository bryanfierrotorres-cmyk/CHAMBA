import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) throw new Error('Unauthorized');

    const { job_id, amount_cents } = await req.json();
    if (!job_id || !amount_cents) throw new Error('Missing job_id or amount_cents');

    // Fetch job to validate
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, pay_amount, status, created_by')
      .eq('id', job_id)
      .single();

    if (jobError || !job) throw new Error('Job not found');
    if (job.status === 'cancelled') throw new Error('Job is cancelled');

    // Platform fee = 5%, worker gets 95%
    const platformFeeAmountCents = Math.round(amount_cents * 0.05);
    const workerAmountCents      = amount_cents - platformFeeAmountCents;

    // Get worker's Stripe account (if exists)
    const { data: assignment } = await supabase
      .from('job_assignments')
      .select('worker_id, worker:profiles!worker_id(stripe_account_id)')
      .eq('job_id', job_id)
      .limit(1)
      .single();

    const workerStripeAccountId = (assignment?.worker as any)?.stripe_account_id ?? null;

    // Create PaymentIntent
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount:   amount_cents,
      currency: 'usd',
      metadata: {
        job_id,
        worker_id:          assignment?.worker_id ?? '',
        platform_fee_cents: String(platformFeeAmountCents),
        worker_amount_cents: String(workerAmountCents),
      },
      automatic_payment_methods: { enabled: true },
    };

    // If worker has Stripe Connect, use transfer
    if (workerStripeAccountId) {
      paymentIntentParams.transfer_data = {
        destination: workerStripeAccountId,
        amount: workerAmountCents,
      };
      paymentIntentParams.application_fee_amount = platformFeeAmountCents;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Store payment intent ID in assignment
    if (assignment?.worker_id) {
      await supabase
        .from('job_assignments')
        .update({ payment_intent_id: paymentIntent.id, payment_status: 'processing' })
        .eq('job_id', job_id)
        .eq('worker_id', assignment.worker_id);
    }

    return new Response(
      JSON.stringify({
        client_secret:     paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
