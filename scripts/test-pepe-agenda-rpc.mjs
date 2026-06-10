#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PEPE_ID = '43ce7eec-c77a-497a-a1d1-99e0946b83f8';

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

async function testRpc(sb, name) {
  const t0 = Date.now();
  const { data, error } = await sb.rpc(name, { p_worker_id: PEPE_ID });
  const ms = Date.now() - t0;
  const rows = Array.isArray(data) ? data : [];
  const active = rows.filter((r) => ['taken', 'in_progress', 'open'].includes(r.job?.status));
  console.log(`${name}: ${error ? 'ERROR ' + error.message : rows.length + ' filas'} (${ms}ms)`);
  for (const r of active.slice(0, 5)) {
    console.log(`  ${r.job?.status} | ${r.selection_status} | ${r.job?.title}`);
  }
}

async function main() {
  const sb = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await testRpc(sb, 'get_worker_agenda_panel');
  await testRpc(sb, 'get_worker_assignments');

  const password = process.env.EXPO_PUBLIC_PILOT_PHONE_PASSWORD?.trim() || 'ChambaTest123!';
  const { data: signIn, error: signErr } = await sb.auth.signInWithPassword({
    email: '84888888@phone.chamba.local',
    password,
  });
  if (signErr) console.log('\nAuth signIn:', signErr.message);
  else {
    console.log('\nAuth OK uid=', signIn.user?.id);
    await testRpc(sb, 'get_worker_agenda_panel');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
