#!/usr/bin/env node
/**
 * Repara Mama Mama (cliente) y papa papa (técnico) en producción:
 * - auth.users con tokens '' (login GoTrue)
 * - is_approved = true
 * npm run db:fix-mama-papa
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import {
  insertPhoneAuthUser,
  patchAllAuthUserTokenColumns,
} from './lib/phoneAuthSql.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHONES = ['88888888', '84888888'];

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

const PHONE_AUTH_PASSWORD =
  process.env.EXPO_PUBLIC_PILOT_PHONE_PASSWORD?.trim() || 'ChambaTest123!';

const emailFor = (phone) => `${phone.replace(/\D/g, '')}@phone.chamba.local`;

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!dbUrl) {
    console.error('SUPABASE_DB_URL required');
    process.exit(1);
  }

  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  console.log('Parcheando tokens NULL en auth.users existentes…');
  await patchAllAuthUserTokenColumns(db);

  for (const phone of PHONES) {
    const { rows: [profile] } = await db.query(
      `
      SELECT id, full_name, phone, role::text AS role, is_approved
      FROM profiles
      WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1
      ORDER BY created_at ASC
      LIMIT 1
      `,
      [phone],
    );
    if (!profile) {
      console.warn(`⚠️  Sin perfil para ${phone}`);
      continue;
    }

    const email = emailFor(profile.phone);
    console.log(`\n→ ${profile.full_name} (${profile.role})`);
    await insertPhoneAuthUser(db, {
      userId: profile.id,
      email,
      password: PHONE_AUTH_PASSWORD,
      fullName: profile.full_name,
      role: profile.role,
    });

    await db.query(
      `
      UPDATE profiles
      SET is_approved = TRUE,
          worker_status = CASE WHEN role::text = 'worker' THEN COALESCE(worker_status, 'active') ELSE worker_status END,
          category_1_approved = CASE WHEN role::text = 'worker' THEN TRUE ELSE category_1_approved END,
          category_2_approved = CASE WHEN role::text = 'worker' THEN TRUE ELSE category_2_approved END
      WHERE id = $1::uuid
      `,
      [profile.id],
    );
    console.log(`✅ Auth + aprobación: ${email}`);
  }

  const papa = PHONES[1];
  const { rows: [worker] } = await db.query(
    `SELECT id, full_name, phone, email FROM profiles WHERE regexp_replace(phone, '\\D', '', 'g') = $1 LIMIT 1`,
    [papa],
  );

  if (url && anon && worker) {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const email = worker.email?.includes('@') ? worker.email : emailFor(worker.phone);
    const { error: signErr, data: signIn } = await sb.auth.signInWithPassword({
      email,
      password: PHONE_AUTH_PASSWORD,
    });
    if (signErr) {
      console.error(`\n❌ signIn papa papa: ${signErr.message}`);
    } else {
      console.log(`\n✅ signIn papa papa OK — uid=${signIn.user?.id}`);
      const { data: rpc, error: rpcErr } = await sb.rpc('get_worker_assignments', {
        p_worker_id: worker.id,
      });
      if (rpcErr) console.error('RPC error:', rpcErr.message);
      else {
        const active = (Array.isArray(rpc) ? rpc : []).filter((r) =>
          ['taken', 'in_progress', 'open'].includes(r?.job?.status),
        );
        console.log(`✅ Agenda RPC con JWT: ${active.length} activas/pendientes`);
        for (const row of active.slice(0, 5)) {
          console.log(`   · ${row.job?.status} | ${row.job?.title}`);
        }
      }
    }
  }

  const { rows: summary } = await db.query(`
    SELECT full_name, phone, role::text, is_approved
    FROM profiles
    WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ANY($1::text[])
  `, [PHONES]);
  console.log('\nEstado final:');
  console.table(summary);

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
