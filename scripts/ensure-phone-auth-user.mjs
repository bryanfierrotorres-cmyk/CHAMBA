#!/usr/bin/env node
/**
 * Crea/actualiza auth.users alineado con profiles (login teléfono → auth.uid()).
 * npm run db:ensure-phone-auth -- 84888888
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const phoneArg = process.argv[2]?.replace(/\D/g, '') || '84888888';

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

import { insertPhoneAuthUser } from './lib/phoneAuthSql.mjs';

const emailFor = (phone) => `${phone}@phone.chamba.local`;

async function ensureAuthUser(db, profile) {
  const email = emailFor(profile.phone.replace(/\D/g, ''));
  await insertPhoneAuthUser(db, {
    userId: profile.id,
    email,
    password: PHONE_AUTH_PASSWORD,
    fullName: profile.full_name,
    role: profile.role,
  });
  console.log(`✅ Auth: ${email} → id ${profile.id}`);
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('SUPABASE_DB_URL required');
    process.exit(1);
  }

  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: [profile] } = await db.query(
    `
    SELECT id, full_name, phone, role::text AS role
    FROM profiles
    WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1
    ORDER BY created_at ASC
    LIMIT 1
    `,
    [phoneArg],
  );

  if (!profile) {
    console.error(`No hay perfil con teléfono ${phoneArg}`);
    process.exit(1);
  }

  console.log('Perfil:', profile);
  await ensureAuthUser(db, profile);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
