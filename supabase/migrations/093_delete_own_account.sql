-- 093_delete_own_account.sql
-- Eliminación de cuenta iniciada por el propio usuario (requisito Google Play).
-- SECURITY DEFINER: borra el perfil y el usuario de auth según auth.uid().
--
-- PENDIENTE DE VERIFICACIÓN EN VIVO: aplicar cuando Supabase Cloud esté disponible.
-- Antes de confiar en producción, verificar que las tablas que referencian a
-- public.profiles(id) tengan ON DELETE CASCADE, o agregar aquí los DELETE explícitos.

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado: no se puede eliminar la cuenta sin sesión válida';
  END IF;

  -- Borra el perfil del usuario. Las tablas relacionadas con ON DELETE CASCADE
  -- (reviews, assignments, etc.) se limpian automáticamente.
  DELETE FROM public.profiles WHERE id = v_uid;

  -- Borra el usuario de autenticación. Requiere privilegios del owner de la función
  -- (postgres en Supabase). Tolera 0 filas (usuarios de login por teléfono sin auth.users).
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- Solo usuarios autenticados pueden invocarla; cada uno solo puede borrar SU cuenta
-- (la función usa auth.uid(), no recibe id externo → no hay IDOR).
REVOKE ALL ON FUNCTION delete_own_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
