-- CHAMBA 033 — Push Expo directo desde Postgres (pg_net), sin Edge Functions
SET statement_timeout = '120s';

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.chamba_worker_covers_job_category(
  p_category_1 text,
  p_category_2 text,
  p_cat1_approved boolean,
  p_cat2_approved boolean,
  p_job_category text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  job_cat text := trim(coalesce(p_job_category, ''));
  c1 text := trim(coalesce(p_category_1, ''));
  c2 text := trim(coalesce(p_category_2, ''));
  root1 text;
  root2 text;
BEGIN
  IF job_cat = '' THEN
    RETURN false;
  END IF;

  IF p_cat1_approved AND c1 <> '' THEN
    IF c1 = job_cat THEN RETURN true; END IF;
    root1 := split_part(c1, '_', 1);
    IF length(root1) >= 4 AND job_cat LIKE root1 || '%' THEN RETURN true; END IF;
  END IF;

  IF p_cat2_approved AND c2 <> '' THEN
    IF c2 = job_cat THEN RETURN true; END IF;
    root2 := split_part(c2, '_', 1);
    IF length(root2) >= 4 AND job_cat LIKE root2 || '%' THEN RETURN true; END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.chamba_notify_workers_expo_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  worker_rec RECORD;
  messages jsonb := '[]'::jsonb;
  body_text text;
  request_id bigint;
  expo_url constant text := 'https://exp.host/--/api/v2/push/send';
BEGIN
  IF coalesce(NEW.status, 'open') <> 'open' THEN
    RETURN NEW;
  END IF;

  IF NEW.category IS NULL OR trim(NEW.category) = '' THEN
    RETURN NEW;
  END IF;

  body_text := 'Se necesita ' || coalesce(
    nullif(trim(NEW.title), ''),
    replace(trim(NEW.category), '_', ' ')
  );

  FOR worker_rec IN
    SELECT p.fcm_token
    FROM public.profiles p
    WHERE p.role = 'worker'
      AND p.is_approved = true
      AND p.fcm_token IS NOT NULL
      AND trim(p.fcm_token) <> ''
      AND public.chamba_worker_covers_job_category(
        p.category_1,
        p.category_2,
        coalesce(p.category_1_approved, false),
        coalesce(p.category_2_approved, false),
        NEW.category
      )
  LOOP
    messages := messages || jsonb_build_array(
      jsonb_build_object(
        'to', trim(worker_rec.fcm_token),
        'title', '¡Nueva chamba disponible!',
        'body', body_text,
        'sound', 'default',
        'data', jsonb_build_object(
          'job_id', NEW.id::text,
          'category', NEW.category,
          'screen', 'JobList',
          'type', 'new_job'
        )
      )
    );
  END LOOP;

  IF jsonb_array_length(messages) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := expo_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := messages
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'chamba_notify_workers_expo_push job=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_insert_notify_workers ON public.jobs;

CREATE TRIGGER jobs_insert_notify_workers
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.chamba_notify_workers_expo_push();

COMMENT ON FUNCTION public.chamba_notify_workers_expo_push() IS
  'Envía push Expo a técnicos aprobados con fcm_token cuando se inserta un job open.';
