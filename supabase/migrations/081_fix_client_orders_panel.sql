-- CHAMBA 081 — Fix get_client_orders_panel RPC
-- Error anterior: "relation job_worker_applications does not exist"
-- La tabla real es job_assignments, no job_worker_applications.
-- También corregimos el GROUP BY (j.created_at must appear in GROUP BY).
SET statement_timeout = '60s';

DROP FUNCTION IF EXISTS get_client_orders_panel(UUID);

CREATE OR REPLACE FUNCTION get_client_orders_panel(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', j.id,
        'created_at', j.created_at,
        'updated_at', j.updated_at,
        'status', j.status,
        'title', j.title,
        'description', j.description,
        'price', j.pay_amount,
        'pay_amount', j.pay_amount,
        'category', j.category,
        'location', j.location,
        'address', j.address,
        'lat', j.lat,
        'lng', j.lng,
        'assigned_worker_id', j.assigned_worker_id,
        'operational_phase', j.operational_phase,
        'media_urls', j.media_urls,
        'urgency_level', j.urgency_level,
        'scheduled_at', j.scheduled_at,
        'booking_type', j.booking_type,
        'assigned_worker', CASE 
          WHEN j.assigned_worker_id IS NOT NULL THEN (
            SELECT jsonb_build_object(
              'id', p.id,
              'full_name', p.full_name,
              'avatar_url', p.avatar_url,
              'phone', p.phone
            )
            FROM profiles p WHERE p.id = j.assigned_worker_id
          )
          ELSE NULL
        END,
        'applications_count', (
          SELECT COUNT(*)::int
          FROM job_assignments ja
          WHERE ja.job_id = j.id
        )
      )
      ORDER BY j.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM jobs j
  WHERE j.created_by = p_client_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_client_orders_panel(UUID) TO anon, authenticated;
