#!/usr/bin/env node
/**
 * Verifica y aprovisiona el catálogo dinámico (migración 010).
 *
 * 1. Comprueba conectividad con EXPO_PUBLIC_SUPABASE_* (anon)
 * 2. Si existe SUPABASE_DB_URL → aplica migración en partes
 * 3. Si no hay DB URL → informa estado y deja la app con catálogo local
 *
 * npm run db:provision-catalog
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadEnvFile(name) {
  const envPath = join(ROOT, name);
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
let anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
if (anonKey.includes('publisable')) anonKey = anonKey.replace('publisable', 'publishable');

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const TIMEOUT_MS = 12_000;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms)),
  ]);

async function checkRemoteCatalog() {
  if (!url || !anonKey) {
    console.error('❌ Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en .env');
    process.exit(1);
  }

  console.log(`\n🔍 Proyecto: ${url}`);

  try {
    const health = await withTimeout(
      fetch(`${url}/rest/v1/`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      }),
      TIMEOUT_MS,
    );
    console.log(`   REST health: HTTP ${health.status}`);
  } catch (e) {
    console.log(`   REST health: ⚠ ${e.message}`);
    console.log('\n💡 El proyecto Supabase parece pausado o inaccesible (522).');
    console.log('   Dashboard → Restore project, luego: npm run db:provision-catalog');
    console.log('\n✅ La app web sigue funcionando con catálogo local (8 servicios).');
    return { ok: false, reason: 'unreachable' };
  }

  const sb = createClient(url, anonKey);
  let rpc;
  try {
    rpc = await withTimeout(sb.rpc('get_active_catalog'), TIMEOUT_MS);
  } catch (e) {
    console.log(`   RPC get_active_catalog: ⚠ ${e.message}`);
    console.log('\n💡 Postgres/RPC no responde (proyecto pausado o 522).');
    console.log('   Dashboard → Restore project, luego: npm run db:provision-catalog');
    console.log('\n✅ La app web sigue funcionando con catálogo local (8 servicios).');
    return { ok: false, reason: 'unreachable' };
  }

  if (rpc.error) {
    const msg = rpc.error.message ?? '';
    if (rpc.error.code === 'PGRST202' || msg.includes('get_active_catalog')) {
      console.log('   RPC get_active_catalog: ❌ no existe (migración 010 pendiente)');
      return { ok: false, reason: 'missing_rpc' };
    }
    console.log(`   RPC get_active_catalog: ❌ ${msg.slice(0, 120)}`);
    return { ok: false, reason: 'rpc_error' };
  }

  const cats = rpc.data?.categories?.length ?? 0;
  const types = rpc.data?.service_types?.length ?? 0;
  console.log(`   RPC get_active_catalog: ✅ ${cats} categorías, ${types} tipos`);
  return { ok: cats > 0 || types > 0, reason: 'ready', cats, types };
}

async function applyMigration() {
  if (!dbUrl) {
    console.log('\n⚠ SUPABASE_DB_URL no está en .env — no se puede aplicar DDL automáticamente.');
    console.log('   Añádela desde Dashboard → Database → Connection string (URI, puerto 6543)');
    console.log('   Luego: npm run db:provision-catalog');
    return false;
  }

  console.log('\n▶ Aplicando migración 010 vía Postgres…');
  const { spawnSync } = await import('child_process');
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'apply-catalog-migration.mjs')], {
    stdio: 'inherit',
    env: process.env,
  });
  return result.status === 0;
}

async function main() {
  const status = await checkRemoteCatalog();

  if (status.ok) {
    console.log('\n✅ Catálogo dinámico remoto operativo.');
    return;
  }

  if (status.reason === 'unreachable') {
    return;
  }

  const applied = await applyMigration();
  if (!applied) {
    console.log('\n✅ Modo local activo: la app usa catálogo en AsyncStorage (semilla migración 010).');
    console.log('   Cuando Supabase esté activo y tengas SUPABASE_DB_URL: npm run db:provision-catalog');
    return;
  }

  const verify = await checkRemoteCatalog();
  if (verify.ok) {
    console.log('\n✅ Migración aplicada y catálogo remoto verificado.');
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
