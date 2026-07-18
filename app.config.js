/** @type {import('@expo/config').ExpoConfig} */
const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

function loadEnvFile(filename) {
  try {
    const envPath = path.resolve(__dirname, filename);
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      const value = t.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = value; // el primero cargado gana
    }
  } catch {
    // archivo opcional (CI / EAS Secrets).
  }
}

// .env.local (override de desarrollo) tiene precedencia sobre .env (nube).
// Presencia de .env.local = modo LOCAL; borralo/renombralo para volver a la NUBE.
loadEnvFile('.env.local');
loadEnvFile('.env');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (supabaseAnonKey.includes('publisable')) {
  supabaseAnonKey = supabaseAnonKey.replace('publisable', 'publishable');
}

const googleServicesPath = path.resolve(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

/** @type {import('@expo/config').ExpoConfig['android']} */
const android = {
  ...appJson.expo.android,
  versionCode: appJson.expo.android.versionCode ?? 1,
};

if (hasGoogleServices) {
  android.googleServicesFile = './google-services.json';
}

const easProjectId =
  process.env.EAS_PROJECT_ID ??
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
  appJson.expo.extra?.eas?.projectId ??
  'f66f053c-93e5-4170-ba77-a665f70c5772';

module.exports = {
  expo: {
    ...appJson.expo,
    android,
    extra: {
      ...appJson.expo.extra,
      supabaseUrl,
      supabaseAnonKey,
      devMode: process.env.EXPO_PUBLIC_DEV_MODE === 'true',
      pilotMode: process.env.EXPO_PUBLIC_PILOT_MODE === 'true',
      dataMode: process.env.EXPO_PUBLIC_DATA_MODE ?? 'production',
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
      eas: {
        ...appJson.expo.extra?.eas,
        projectId: easProjectId,
      },
    },
  },
};
