#!/usr/bin/env node
/** Casos borde publicación */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    if (!process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
const CLIENT_ID = 'cb92c728-f64f-4e9c-9c0b-aef479375e02';

const cases = [
  { label: 'desc corta (debe fallar)', cat: 'limpieza_sofas', desc: 'corta', expectFail: true },
  { label: 'ac_mantenimiento', cat: 'ac_mantenimiento', desc: 'Mantenimiento preventivo del equipo split.', expectFail: false },
  { label: 'conserjeria_ocasional', cat: 'conserjeria_ocasional', desc: 'Limpieza general de casa completa hoy.', expectFail: false },
  { label: 'electricista', cat: 'electricista', desc: 'Revisión de tomacorrientes y panel eléctrico.', expectFail: false },
];

console.log('\n── Casos borde RPC create_client_job ──\n');

for (const c of cases) {
  const { data, error } = await supabase.rpc('create_client_job', {
    p_created_by: CLIENT_ID,
    p_title: 'Test borde CHAMBA',
    p_description: c.desc,
    p_category: c.cat,
    p_pay_amount: 850,
    p_address: 'Managua',
    p_lat: 0,
    p_lng: 0,
    p_duration_hours: 2,
    p_required_workers: 1,
    p_media_urls: [],
  });

  const failed = !!error || !data?.success;
  const msg = error?.message ?? data?.error ?? `OK → ${data?.job?.id}`;
  const ok = c.expectFail ? failed : !failed;
  console.log(`${ok ? '✅' : '❌'} ${c.label}`);
  console.log(`   → ${msg}\n`);

  if (data?.job?.id) {
    await supabase.from('jobs').delete().eq('id', data.job.id);
  }
}
