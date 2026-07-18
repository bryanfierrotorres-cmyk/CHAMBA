-- seed_dev_users.sql — Usuarios de prueba para desarrollo LOCAL.
-- Replican los de producción (datos capturados por diagnóstico el 2026-06-27).
-- Se aplica MANUALMENTE contra la BD local (no en supabase start, para no arriesgar el arranque).
-- Idempotente: ON CONFLICT (id) DO NOTHING. El trigger de 084 rellena phone_normalized.
--
-- Aplicar:  psql "<DB_URL_LOCAL>" -f supabase/seed_dev_users.sql
--    o:     Get-Content supabase/seed_dev_users.sql | docker exec -i supabase_db_CHAMBA psql -U postgres

INSERT INTO public.profiles
  (id, role, email, phone, full_name, is_approved, worker_status, created_at, updated_at)
VALUES
  ('b0332110-9d62-46f4-89d2-d4139d9a98e3', 'client', 'cliente@prueba.com', '88883333',
   'Cliente de Prueba', true, NULL, now(), now()),
  ('78ae307b-80c1-4185-bbb6-8bc80486d6fd', 'worker', 'tecnico@prueba.com', '88884444',
   'Técnico de Prueba', true, 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Verificación
SELECT phone, full_name, role, is_approved, phone_normalized
FROM public.profiles
WHERE phone IN ('88883333', '88884444')
ORDER BY phone;
-- Esperado: 2 filas con phone_normalized poblado por el trigger
