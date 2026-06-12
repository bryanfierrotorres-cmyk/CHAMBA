/**
 * Disparada por Database Webhook (INSERT en jobs) o invoke desde createJob.
 * Filtra técnicos aprobados con fcm_token y delega el envío a send-push-notification.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';
import type { DbWebhookPayload, JobInsertRecord } from '../_shared/jobNotifyTypes.ts';
import { workerCoversJobCategory } from '../_shared/workerCategoryMatch.ts';
import { buildNewJobNotificationBody } from '../_shared/jobServiceLabel.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-event-signature',
};

const PUSH_TITLE = '¡Nueva chamba disponible!';

const parseWebhookPayload = (raw: unknown): DbWebhookPayload | null => {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;

  if (body.record && typeof body.record === 'object') {
    return body as DbWebhookPayload;
  }

  const nested = body.payload;
  if (nested && typeof nested === 'object' && (nested as DbWebhookPayload).record) {
    return nested as DbWebhookPayload;
  }

  return null;
};

const isOpenJobInsert = (payload: DbWebhookPayload, job: JobInsertRecord): boolean => {
  if (payload.type && payload.type !== 'INSERT') return false;
  if (payload.table && payload.table !== 'jobs') return false;
  const status = (job.status ?? 'open').toLowerCase();
  return status === 'open';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    // ── JWT Verification ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Verify caller is admin ─────────────────────────────────────
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role, is_approved')
      .eq('id', user.id)
      .single();

    if (callerProfile?.role !== 'admin' || callerProfile?.is_approved !== true) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rawBody: unknown = await req.json();
    const payload = parseWebhookPayload(rawBody);

    if (!payload?.record?.id) {
      return new Response(JSON.stringify({ skipped: true, reason: 'not_a_job_insert' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const job = payload.record;

    if (!isOpenJobInsert(payload, job)) {
      return new Response(JSON.stringify({ skipped: true, reason: 'not_open_insert' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jobCategory = (job.category ?? '').trim();
    if (!jobCategory) {
      return new Response(JSON.stringify({ skipped: true, reason: 'missing_category' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: workers, error: workersError } = await supabase
      .from('profiles')
      .select(
        'id, category_1, category_2, category_1_approved, category_2_approved, fcm_token',
      )
      .eq('role', 'worker')
      .eq('is_approved', true)
      .not('fcm_token', 'is', null);

    if (workersError) {
      throw new Error(workersError.message);
    }

    const matchingWorkers = (workers ?? []).filter((worker) =>
      workerCoversJobCategory(worker, jobCategory)
    );

    if (matchingWorkers.length === 0) {
      return new Response(
        JSON.stringify({ notified: 0, category: jobCategory, reason: 'no_matching_workers' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let remoteLabel: string | null = null;
    const { data: serviceType } = await supabase
      .from('service_types')
      .select('name')
      .eq('slug', jobCategory)
      .maybeSingle();

    if (serviceType && typeof serviceType.name === 'string') {
      remoteLabel = serviceType.name;
    }

    const body = buildNewJobNotificationBody(jobCategory, job.title, remoteLabel);
    const workerIds = matchingWorkers.map((w) => w.id);

    const { data: sendResult, error: sendError } = await supabase.functions.invoke(
      'send-push-notification',
      {
        body: {
          user_ids: workerIds,
          title: PUSH_TITLE,
          body,
          type: 'new_job',
          data: {
            job_id: job.id,
            category: jobCategory,
            screen: 'JobList',
          },
        },
      },
    );

    if (sendError) {
      throw new Error(sendError.message);
    }

    return new Response(
      JSON.stringify({
        notified: workerIds.length,
        category: jobCategory,
        title: PUSH_TITLE,
        body,
        sendResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('[notify-new-job]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
