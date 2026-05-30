/** @type {import('@expo/config').ExpoConfig} */
const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

// Carga .env de forma explícita (Node no lo hace solo al evaluar app.config.js).
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
    // .env opcional en CI; Expo también puede inyectar EXPO_PUBLIC_* antes.
  }
}

loadEnvFile();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Corrige typo histórico que provoca "Invalid API key" en Supabase.
if (supabaseAnonKey.includes('publisable')) {
  supabaseAnonKey = supabaseAnonKey.replace('publisable', 'publishable');
}

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      supabaseUrl,
      supabaseAnonKey,
      pilotMode: process.env.EXPO_PUBLIC_PILOT_MODE ?? 'true',
    },
  },
};
