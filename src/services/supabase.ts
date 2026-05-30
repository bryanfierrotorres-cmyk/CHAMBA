import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { CONFIG } from '@constants/config';

/**
 * Resuelve credenciales de Supabase.
 * Prioriza app.config.js → extra (fiable) sobre process.env (puede quedar en caché de Metro).
 */
function resolveSupabaseConfig() {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

  let url = CONFIG.supabase.url || extra.supabaseUrl || '';
  let anonKey = CONFIG.supabase.anonKey || extra.supabaseAnonKey || '';

  // Auto-fix typo común que Supabase rechaza con "Invalid API key".
  if (anonKey.includes('publisable')) {
    anonKey = anonKey.replace('publisable', 'publishable');
  }

  const isPlaceholder =
    !url ||
    !anonKey ||
    url.includes('YOUR_') ||
    anonKey.includes('YOUR_');

  if (isPlaceholder) {
    throw new Error(
      '[Supabase] API key o URL inválidas.\n' +
        '1. Verifica .env → EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
        '2. La key debe empezar con sb_publishable_ (no sb_publisable_)\n' +
        '3. Reinicia Expo: npx expo start --clear',
    );
  }

  if (__DEV__) {
    console.log('[Supabase] URL:', url);
    console.log('[Supabase] Key prefix:', anonKey.slice(0, 18) + '...');
  }

  return { url, anonKey };
}

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = resolveSupabaseConfig();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

export const onAuthStateChange = (
  callback: (event: string, session: import('@supabase/supabase-js').Session | null) => void,
) => {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
};
