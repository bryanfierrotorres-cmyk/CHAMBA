import Constants from 'expo-constants';

declare global {
  interface Window {
    __CHAMBA_ENV__?: Record<string, string>;
  }
}

const EXTRA_KEY_MAP: Record<string, string> = {
  EXPO_PUBLIC_SUPABASE_URL:       'supabaseUrl',
  EXPO_PUBLIC_SUPABASE_ANON_KEY:  'supabaseAnonKey',
  EXPO_PUBLIC_PILOT_MODE:         'pilotMode',
  EXPO_PUBLIC_DEV_MODE:           'devMode',
  EXPO_PUBLIC_DATA_MODE:          'dataMode',
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'stripePublishableKey',
};

/**
 * Lee variables EXPO_PUBLIC_* inyectadas en build (Metro/Expo export).
 * Expo Web embebe process.env.EXPO_PUBLIC_* en el bundle estático de Vercel.
 */
export function readPublicEnv(key: string): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  const extraField = EXTRA_KEY_MAP[key];
  if (extraField && extra[extraField]) {
    return String(extra[extraField]);
  }

  if (typeof process !== 'undefined' && process.env?.[key]) {
    return String(process.env[key]);
  }

  if (typeof window !== 'undefined' && window.__CHAMBA_ENV__?.[key]) {
    return window.__CHAMBA_ENV__[key]!;
  }

  return '';
}

export function readSupabaseAnonKey(): string {
  const raw = readPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return raw.includes('publisable') ? raw.replace('publisable', 'publishable') : raw;
}

export const ENV = {
  // Leen del entorno (.env / .env.local) para permitir el switch local↔nube.
  // Fallback a los valores de la nube si no hay env (comportamiento previo).
  SUPABASE_URL:              readPublicEnv('EXPO_PUBLIC_SUPABASE_URL') || 'https://xvolxgonpjzjkytpsmil.supabase.co',
  SUPABASE_ANON_KEY:         readSupabaseAnonKey() || 'sb_publishable_uhhzt2htaTjd2BmCOJn80g__R-_shQZ',
  DEV_MODE:                 true, // readPublicEnv('EXPO_PUBLIC_DEV_MODE') === 'true',
  PILOT_MODE:               readPublicEnv('EXPO_PUBLIC_PILOT_MODE') === 'true',
  STRIPE_PUBLISHABLE_KEY:   readPublicEnv('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  // 'demo' | 'development' | 'production'. Sin definir → 'production' (comportamiento actual, sin cambios).
  DATA_MODE:                readPublicEnv('EXPO_PUBLIC_DATA_MODE') || 'production',
};
