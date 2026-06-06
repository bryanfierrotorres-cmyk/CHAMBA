-- CHAMBA 025 — Fix RLS mensajes: login teléfono sin auth.uid() al insertar vía RPC
-- ⚠ DEUDA TÉCNICA (solo desarrollo): row_security = off en RPC de chat.
-- Objetivo producción: sync login teléfono → Supabase Auth (auth.uid() válido) + RLS nativo sin bypass.
-- Ver .cursor/rules/supabase-rls-security.mdc
SET statement_timeout = '60s';

-- Las funciones RPC deben poder insertar/leer sin evaluar RLS del invocador
CREATE OR REPLACE FUNCTION send_job_chat_message(
  p_servicio_id UUID,
  p_remitente_id UUID,
  p_texto TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_msg   mensajes%ROWTYPE;
  v_text  TEXT;
BEGIN
  v_text := trim(p_texto);

  IF char_length(v_text) = 0 OR char_length(v_text) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El mensaje debe tener entre 1 y 2000 caracteres');
  END IF;

  IF NOT job_chat_user_can_write(p_servicio_id, p_remitente_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No podés enviar mensajes en este servicio (debe estar en curso y vos ser parte del mismo)'
    );
  END IF;

  INSERT INTO mensajes (servicio_id, remitente_id, texto)
  VALUES (p_servicio_id, p_remitente_id, v_text)
  RETURNING * INTO v_msg;

  RETURN jsonb_build_object(
    'success', true,
    'message', jsonb_build_object(
      'id', v_msg.id,
      'servicio_id', v_msg.servicio_id,
      'remitente_id', v_msg.remitente_id,
      'texto', v_msg.texto,
      'creado_al', v_msg.creado_al
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_job_chat_messages(
  p_servicio_id UUID,
  p_caller_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_messages JSONB;
BEGIN
  IF NOT job_chat_user_can_access(p_servicio_id, p_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tenés acceso a esta conversación');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'servicio_id', m.servicio_id,
        'remitente_id', m.remitente_id,
        'texto', m.texto,
        'creado_al', m.creado_al
      )
      ORDER BY m.creado_al ASC
    ),
    '[]'::jsonb
  )
  INTO v_messages
  FROM mensajes m
  WHERE m.servicio_id = p_servicio_id;

  RETURN jsonb_build_object('success', true, 'messages', v_messages);
END;
$$;

-- Políticas directas (PostgREST): validar participante por remitente_id, no auth.uid()
DROP POLICY IF EXISTS mensajes_insert_participant ON mensajes;
CREATE POLICY mensajes_insert_participant ON mensajes
  FOR INSERT
  WITH CHECK (job_chat_user_can_write(servicio_id, remitente_id));

DROP POLICY IF EXISTS mensajes_select_participant ON mensajes;
CREATE POLICY mensajes_select_participant ON mensajes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND job_chat_user_can_access(servicio_id, auth.uid())
  );

GRANT EXECUTE ON FUNCTION send_job_chat_message(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_job_chat_messages(UUID, UUID) TO anon, authenticated;
