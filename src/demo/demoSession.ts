import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/types';

/**
 * DEMO MODE — Sesión local sin Supabase.
 *
 * Construye un objeto `Session` mínimo (suficiente para `isAuthenticated` en el
 * RootNavigator y para los selectores que leen `session.user.id`) y lo persiste
 * en AsyncStorage para restaurarlo al reabrir la app. No es una sesión real de
 * Supabase: solo existe cuando ENV.DATA_MODE === 'demo'.
 */

const DEMO_SESSION_KEY = 'CHAMBA_DEMO_SESSION';

/** Token marcador; nunca se envía a ningún servidor. */
export const DEMO_ACCESS_TOKEN = 'demo-session-token';

/** Código OTP aceptado en modo demo (mismo criterio que el DEV_MODE previo). */
export const DEMO_OTP_CODE = '123456';

/** Contraseña del acceso admin oculto (doble tap en el logo) en modo demo.
 * Mismo valor que el OTP a propósito: una sola credencial "mágica" para recordar. */
export const DEMO_ADMIN_PASSWORD = DEMO_OTP_CODE;

export function buildDemoSession(profile: UserProfile): Session {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: DEMO_ACCESS_TOKEN,
    refresh_token: DEMO_ACCESS_TOKEN,
    expires_in: 3600,
    expires_at: nowSec + 3600,
    token_type: 'bearer',
    user: {
      id: profile.id,
      app_metadata: { provider: 'demo' },
      user_metadata: {
        full_name: profile.full_name,
        phone: profile.phone,
        role: profile.role,
      },
      aud: 'authenticated',
      created_at: profile.created_at,
    },
  } as unknown as Session;
}

export async function persistDemoSession(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ userId }));
  } catch {
    // AsyncStorage no disponible: la sesión sigue viva en memoria durante la sesión actual
  }
}

export async function clearDemoSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    // nada que limpiar
  }
}

export async function readDemoSessionUserId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string };
    return parsed.userId ?? null;
  } catch {
    return null;
  }
}
