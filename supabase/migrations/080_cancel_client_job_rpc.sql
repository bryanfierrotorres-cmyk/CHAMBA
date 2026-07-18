-- CHAMBA 080 — RPC seguro para cancelar solicitud del cliente
-- El UPDATE directo falla por RLS (auth.uid() puede ser NULL con phone-auth piloto).
-- Solución: RPC SECURITY DEFINER que valida ownership por p_client_id.
SET statement_timeout = '60s';

DROP FUNCTION IF EXISTS cancel_client_job(UUID, UUID);

CREATE OR REPLACE FUNCTION cancel_client_job(
  p_job_id    UUID,
  p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  -- 1. Buscar el job
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solicitud no encontrada'
    );
  END IF;

  -- 2. Validar que el solicitante sea el dueño del job
  IF v_job.created_by <> p_client_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No tienes permisos para cancelar esta solicitud'
    );
  END IF;

  -- 3. Validar que el status sea cancelable (solo 'open')
  IF v_job.status::text <> 'open' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'No se puede cancelar. El estado actual es ''%s'', solo se puede cancelar en estado ''open''.',
        v_job.status::text
      )
    );
  END IF;

  -- 4. Ejecutar la cancelación
  UPDATE jobs
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_job_id;

  -- 5. Retornar el job actualizado
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job', to_jsonb(v_job)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_client_job(UUID, UUID) TO anon, authenticated;
