#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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

const MAMA_ID = '11111111-1111-1111-1111-111111111101';

async function main() {
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  const { data, error } = await client.rpc('create_client_job', {
    p_created_by: MAMA_ID,
    p_title: 'Prueba Radar — Sofás',
    p_description: 'Solicitud de prueba mama → pepe',
    p_category: 'limpieza_sofas',
    p_pay_amount: 1400,
    p_address: 'Managua, Nicaragua',
    p_lat: 12.1364,
    p_lng: -86.2514,
    p_duration_hours: 2,
    p_required_workers: 1,
    p_scheduled_at: null,
    p_media_urls: [],
  });

  if (error) {
    console.error('❌', error.message);
    process.exit(1);
  }
  if (!data?.success) {
    console.error('❌', data?.error ?? 'RPC falló');
    process.exit(1);
  }
  console.log('✅ Job creado:', data.job?.id, data.job?.title);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
