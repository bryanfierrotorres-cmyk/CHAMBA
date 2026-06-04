import { readPublicEnv } from '@utils/env';

/**
 * Sentinel interno: indica documento omitido en modo piloto.
 * No es una URL — no usar como src de imagen.
 */
export const PILOT_DOCUMENT_BYPASS = 'pilot-bypass';

export const isPilotDocumentBypass = (url: string | null | undefined): boolean =>
  !url || url === PILOT_DOCUMENT_BYPASS;

/** Dominio sintético para perfiles creados solo con teléfono (sin Supabase Auth). */
export const pilotPhoneEmail = (phoneDigits: string): string =>
  `${phoneDigits}@${readPublicEnv('EXPO_PUBLIC_PILOT_EMAIL_DOMAIN') || 'phone.chamba.local'}`;

/** IDs estables opcionales (definir en .env si el piloto admin publica jobs). */
export function getPilotProfileId(role: 'admin' | 'worker'): string | null {
  const key = role === 'admin' ? 'EXPO_PUBLIC_PILOT_ADMIN_ID' : 'EXPO_PUBLIC_PILOT_WORKER_ID';
  const id = readPublicEnv(key).trim();
  return id || null;
}
