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
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'stripePublishableKey',
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:    'googleMapsApiKey',
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
