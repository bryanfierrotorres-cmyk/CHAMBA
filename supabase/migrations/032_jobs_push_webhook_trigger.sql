-- CHAMBA 032 — Trigger pg_net: INSERT jobs → notify-new-job
SET statement_timeout = '60s';

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.chamba_notify_new_job_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  request_id bigint;
  function_url text := 'https://twsrthtyaglpymdfdtdp.supabase.co/functions/v1/notify-new-job';
BEGIN
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'jobs',
      'schema', 'public',
      'record', jsonb_build_object(
        'id', NEW.id,
        'title', NEW.title,
        'category', NEW.category,
        'status', NEW.status,
        'pay_amount', NEW.pay_amount,
        'worker_payout', NEW.worker_payout
      )
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'chamba_notify_new_job_webhook: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_insert_notify_workers ON public.jobs;

CREATE TRIGGER jobs_insert_notify_workers
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.chamba_notify_new_job_webhook();
