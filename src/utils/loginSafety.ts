/**
 * CHAMBA SYSTEM GUARD — Seguridad del login.
 *
 * REGLA CRÍTICA: ningún login puede decir "Número no registrado" sin antes
 * confirmar que el sistema está sano. Distingue:
 *   - usuario realmente inexistente  → "Número no registrado"
 *   - servidor caído / saturado       → mensaje de servicio, NO culpar al usuario
 *
 * NO cambia la lógica de negocio del login: el happy path devuelve el perfil igual.
 */
import type { UserProfile } from '@/types';
import { lookupProfileByPhone, normalizePhone } from '@utils/profileSync';
import { diagnoseSystem, type SystemDiagnosis } from '@utils/systemHealth';

const maskPhone = (digits: string): string =>
  digits.length >= 4 ? `••••${digits.slice(-4)}` : '••••';

function userMessageForHealth(h: SystemDiagnosis): string {
  if (!h.internet) return 'Sin conexión a internet. Revisá tu conexión e intentá de nuevo.';
  if (h.supabase === 'down') return 'Servicio temporalmente no disponible. Intentá en unos minutos.';
  if (h.rpc === 'error') return 'Sistema en mantenimiento. Intentá más tarde.';
  if (h.rpc === 'timeout' || h.supabase === 'slow') {
    return 'El servidor está lento. Esperá un momento e intentá de nuevo.';
  }
  return 'No pudimos verificar tu número. Esperá un momento e intentá de nuevo.';
}

/** El número no existe en la BD (servidor confirmado sano). */
export class ProfileNotRegisteredError extends Error {
  constructor() {
    super('Número no registrado, por favor regístrate primero');
    this.name = 'ProfileNotRegisteredError';
  }
}

/** El sistema (internet/Supabase/RPC) falló; NO sabemos si el usuario existe. */
export class SystemUnavailableError extends Error {
  readonly diagnosis: SystemDiagnosis;
  constructor(diagnosis: SystemDiagnosis) {
    super(userMessageForHealth(diagnosis));
    this.name = 'SystemUnavailableError';
    this.diagnosis = diagnosis;
  }
}

function logLoginDiagnostic(
  phone: string,
  result: 'not_found' | 'unavailable',
  health: SystemDiagnosis | null,
): void {
  const log = {
    step: 'login',
    result,
    phone: maskPhone(normalizePhone(phone)),
    internet: health?.internet ?? true,
    supabase: health?.supabase ?? 'ok',
    rpc: health?.rpc ?? 'ok',
    status: health?.status ?? 'OK',
    reason: health?.reason ?? (result === 'not_found' ? 'usuario inexistente (servidor OK)' : ''),
  };
  console.warn('[LOGIN_DIAG]', JSON.stringify(log));
}

/**
 * Resuelve el perfil para el login.
 * @returns el perfil si existe.
 * @throws SystemUnavailableError si el sistema falló (no se debe culpar al usuario).
 * @throws ProfileNotRegisteredError si el número genuinamente no existe.
 */
export async function resolveLoginProfile(phone: string): Promise<UserProfile> {
  const lookup = await lookupProfileByPhone(phone);

  if (lookup.status === 'found') return lookup.profile;

  if (lookup.status === 'unavailable') {
    // El servidor no respondió de forma confiable → diagnosticar el origen real
    // ANTES de mostrar cualquier mensaje. (REGLA CRÍTICA del SYSTEM GUARD.)
    const health = await diagnoseSystem(normalizePhone(phone));
    logLoginDiagnostic(phone, 'unavailable', health);
    throw new SystemUnavailableError(health);
  }

  // status 'not_found': lookupProfileByPhone solo lo devuelve tras una respuesta
  // 200 del servidor (RPC null o SELECT vacío). El sistema está sano → es seguro
  // afirmar que el número no está registrado.
  logLoginDiagnostic(phone, 'not_found', null);
  throw new ProfileNotRegisteredError();
}
