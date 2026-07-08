import { supabase } from '@services/supabase';
import { ENV } from '@utils/env';

/**
 * Elimina la cuenta del usuario autenticado.
 *
 * - DEMO: no hay backend real; simula la operación. La limpieza de sesión la hace
 *   el llamador (signOut/reset del authStore).
 * - PRODUCCIÓN: invoca el RPC SECURITY DEFINER `delete_own_account()` (migración 093),
 *   que borra el perfil y el usuario de auth según auth.uid().
 *
 * NOTA (pendiente de verificación en vivo): el RPC requiere que Supabase Cloud esté
 * disponible y que el usuario tenga una sesión de auth real. Para el flujo de login por
 * teléfono (sesión simulada en DEV_MODE) la eliminación server-side definitiva se resuelve
 * por la vía de solicitud web/correo documentada en /eliminar-cuenta.html.
 */
export async function deleteOwnAccount(): Promise<void> {
  if (ENV.DATA_MODE === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return;
  }

  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    throw new Error(error.message);
  }
}
