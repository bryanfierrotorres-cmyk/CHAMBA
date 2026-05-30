import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

function resolveAnonKey(): string {
  const raw =
    extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return raw.includes('publisable') ? raw.replace('publisable', 'publishable') : raw;
}

export const CONFIG = {
  supabase: {
    url: extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    anonKey: resolveAnonKey(),
  },
  stripe: {
    publishableKey:
      extra.stripePublishableKey ?? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  },
  googleMaps: {
    apiKey: extra.googleMapsApiKey ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  },
  firebase: {
    webApiKey: extra.firebaseWebApiKey ?? process.env.EXPO_PUBLIC_FIREBASE_WEB_API_KEY ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'chamba-app',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  },
  platform: {
    commissionRate: 0.05,
    workerPayoutRate: 0.95,
    currency: 'NIO',
    currencySymbol: 'C$',
    maxDistanceKm: 50,
  },
  pilot: {
    enabled: (process.env.EXPO_PUBLIC_PILOT_MODE ?? extra.pilotMode ?? 'true') !== 'false',
    worker: {
      email:    'worker1@chamba.com',
      password: 'Worker123!',
      fullName: 'Juan Piloto',
      phone:    '5512345679',
    },
    admin: {
      email:    'admin@chamba.com',
      password: 'Admin123!',
      fullName: 'Admin Piloto',
      phone:    '5512345678',
    },
  },
} as const;
