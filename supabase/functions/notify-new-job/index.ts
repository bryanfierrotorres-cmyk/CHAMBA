/**
 * Triggered via Supabase Database Webhook or client invoke when a new job is inserted.
 * Sends push notification to approved workers whose specialty matches the job category.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CATEGORY_LABELS: Record<string, string> = {
  limpieza_sofas:          'Limpieza de Sofás',
  limpieza_alfombra:       'Limpieza de Alfombra',
  alfombra_institucional:  'Limpieza de Alfombra Institucional',
  fumigacion:              'Fumigación',
  vehiculo_profundo:       'Limpieza Profunda y Detallado de Vehículo',
  conserjeria_ocasional:   'Conserjería Ocasional',
  conserjeria_contrato:    'Conserjería por Contrato',
  jardineria:              'Jardinería',
};

function workerMatchesCategory(
  worker: {
    category_1: string | null;
    category_2: string | null;
    category_1_approved: boolean | null;
    category_2_approved: boolean | null;
  },
  jobCategory: string,
): boolean {
  if (worker.category_1 === jobCategory && worker.category_1_approved) return true;
  if (worker.category_2 === jobCategory && worker.category_2_approved) return true;
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const payload = await req.json();
  const job     = payload.record;

  if (!job || payload.type !== 'INSERT') {
    return new Response('Not a job insert', { status: 200 });
  }

  const jobCategory = job.category as string;

  const { data: workers, error } = await supabase
    .from('profiles')
    .select('id, category_1, category_2, category_2_approved, fcm_token')
    .eq('role', 'worker')
    .eq('is_approved', true)
    .not('fcm_token', 'is', null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const matchingWorkers = (workers ?? []).filter((w) =>
    workerMatchesCategory(w, jobCategory)
  );

  const workerIds = matchingWorkers.map((w) => w.id);

  if (!workerIds.length) {
    return new Response(
      JSON.stringify({ notified: 0, category: jobCategory }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const categoryLabel = CATEGORY_LABELS[jobCategory] ?? jobCategory;
  const payFormatted  = `C$${Number(job.pay_amount).toLocaleString('es-NI')}`;

  await supabase.functions.invoke('send-push-notification', {
    body: {
      user_ids: workerIds,
      title:    '⚡ Nueva chamba en tu rubro',
      body:     `${categoryLabel}: ${job.title} — ${payFormatted}`,
      type:     'new_job',
      data:     { job_id: job.id, category: jobCategory, screen: 'JobDetail' },
    },
  });

  return new Response(
    JSON.stringify({ notified: workerIds.length, category: jobCategory }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
