import { readPublicEnv, readSupabaseAnonKey } from '@utils/env';

export const CONFIG = {
  supabase: {
    url: readPublicEnv('EXPO_PUBLIC_SUPABASE_URL'),
    anonKey: readSupabaseAnonKey(),
  },
  stripe: {
    publishableKey: readPublicEnv('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  },
  googleMaps: {
    apiKey: readPublicEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'),
  },
  firebase: {
    webApiKey: readPublicEnv('EXPO_PUBLIC_FIREBASE_WEB_API_KEY'),
    projectId: readPublicEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID') || 'chamba-app',
    messagingSenderId: readPublicEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readPublicEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
  },
  platform: {
    commissionRate: 0.05,
    workerPayoutRate: 0.95,
    currency: 'NIO',
    currencySymbol: 'C$',
    maxDistanceKm: 50,
  },
  pilot: {
    enabled: readPublicEnv('EXPO_PUBLIC_PILOT_MODE') !== 'false',
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
