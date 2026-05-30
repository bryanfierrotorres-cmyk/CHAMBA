/** @type {import('@expo/config').ExpoConfig} */
const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

function loadEnvFile() {
  try {
    const envPath = path.resolve(__dirname, '.env');
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      const value = t.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env opcional en CI / EAS Secrets.
  }
}

loadEnvFile();

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
  appJson.expo.extra?.eas?.projectId;

module.exports = {
  expo: {
    ...appJson.expo,
    android,
    extra: {
      ...appJson.expo.extra,
      supabaseUrl,
      supabaseAnonKey,
      pilotMode: process.env.EXPO_PUBLIC_PILOT_MODE ?? 'true',
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      eas: {
        ...appJson.expo.extra?.eas,
        projectId: easProjectId,
      },
    },
  },
};
