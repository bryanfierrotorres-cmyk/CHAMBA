import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readPublicEnv, readSupabaseAnonKey } from '@utils/env';

export interface SupabaseConfigResult {
  url: string;
  anonKey: string;
  error: string | null;
}

/**
 * Resuelve credenciales de Supabase sin lanzar excepciones.
 * Prioriza extra de app.config (build Vercel) → process.env EXPO_PUBLIC_*.
 */
export function resolveSupabaseConfig(): SupabaseConfigResult {
  let url = readPublicEnv('EXPO_PUBLIC_SUPABASE_URL');
  let anonKey = readSupabaseAnonKey();

  const isPlaceholder =
    !url ||
    !anonKey ||
    url.includes('YOUR_') ||
    anonKey.includes('YOUR_');

  if (isPlaceholder) {
    return {
      url:     '',
      anonKey: '',
      error:
        'Faltan las credenciales de Supabase en el build.\n\n' +
        'Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
        'en Vercel (Environment Variables) y vuelve a desplegar.',
    };
  }

  if (__DEV__) {
    console.log('[Supabase] URL:', url);
    console.log('[Supabase] Key prefix:', anonKey.slice(0, 18) + '...');
  }

  return { url, anonKey, error: null };
}

let _client: SupabaseClient | null = null;
let _cachedConfigError: string | null | undefined;

/** Error de configuración detectado antes de crear el cliente (sin crash silencioso). */
export function getSupabaseConfigError(): string | null {
  if (_cachedConfigError !== undefined) {
    return _cachedConfigError;
  }
  const cfg = resolveSupabaseConfig();
  _cachedConfigError = cfg.error;
  return cfg.error;
}

function createSupabaseClient(): SupabaseClient {
  const cfg = resolveSupabaseConfig();
  if (cfg.error) {
    throw new Error(cfg.error);
  }

  return createClient(cfg.url, cfg.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
}

function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createSupabaseClient();
  }
  return _client;
}

/**
 * Cliente Supabase con inicialización perezosa.
 * Evita crash al importar el módulo cuando faltan env vars en Vercel.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

export const onAuthStateChange = (
  callback: (event: string, session: import('@supabase/supabase-js').Session | null) => void,
) => {
  const { data } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
};
