#!/usr/bin/env node
/**
 * Despliega notify-new-job y send-push-notification vía Supabase CLI.
 * Requiere SUPABASE_ACCESS_TOKEN en .env (Dashboard → Account → Access Tokens)
 * o haber ejecutado `npx supabase login` antes.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = 'twsrthtyaglpymdfdtdp';
const FUNCTIONS = ['notify-new-job', 'send-push-notification'];

function loadEnv() {
  const envPath = join(ROOT, '.env');
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
loadEnv();

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('❌ Falta SUPABASE_ACCESS_TOKEN en .env');
  console.error('   1. https://supabase.com/dashboard/account/tokens → Generate new token');
  console.error('   2. Agregá a .env: SUPABASE_ACCESS_TOKEN=sbp_...');
  console.error('   3. Volvé a correr: npm run deploy:push-functions');
  process.exit(1);
}

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

for (const slug of FUNCTIONS) {
  console.log(`\n📦 Deploy ${slug}…`);
  const result = spawnSync(
    npxCmd,
    [
      'supabase',
      'functions',
      'deploy',
      slug,
      '--project-ref',
      PROJECT_REF,
      '--no-verify-jwt',
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env },
      shell: process.platform === 'win32',
    },
  );

  if (result.status !== 0) {
    console.error(`❌ Deploy falló: ${slug}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n✅ Edge Functions desplegadas:', FUNCTIONS.join(', '));
