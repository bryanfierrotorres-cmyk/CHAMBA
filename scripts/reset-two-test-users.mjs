#!/usr/bin/env node
/**
 * Limpia datos de prueba y deja solo 2 cuentas:
 *   mama papa  88888888 → cliente
 *   pepe pepe  84888888 → técnico (aprobado, piloto)
 *
 * Requiere SUPABASE_DB_URL en .env
 * npm run db:reset-two-users
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

const ACCOUNTS = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    full_name: 'mama papa',
    phone: '88888888',
    role: 'client',
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    full_name: 'pepe pepe',
    phone: '84888888',
    role: 'worker',
  },
];

const emailFor = (phone) => `${phone}@phone.chamba.local`;

const PHONE_AUTH_PASSWORD =
  process.env.EXPO_PUBLIC_PILOT_PHONE_PASSWORD?.trim() || 'ChambaTest123!';

/** Crea usuarios Auth por SQL (mismo id que profiles) — funciona solo con SUPABASE_DB_URL. */
async function ensureAuthUsersSql(db, accounts) {
  await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  for (const acc of accounts) {
    const email = emailFor(acc.phone);
    const userId = acc.id;

    await db.query(
      `DELETE FROM auth.identities WHERE user_id = $1::uuid`,
      [userId],
    );
    await db.query(`DELETE FROM auth.users WHERE id = $1::uuid`, [userId]);

    await db.query(
      `
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        $1::uuid,
        'authenticated',
        'authenticated',
        $2,
        crypt($3, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        $4::jsonb,
        NOW(),
        NOW()
      )
      `,
      [
        userId,
        email,
        PHONE_AUTH_PASSWORD,
        JSON.stringify({ full_name: acc.full_name, role: acc.role }),
      ],
    );

    const { rows: idRows } = await db.query(`SELECT gen_random_uuid() AS identity_id`);
    const identityId = idRows[0].identity_id;

    await db.query(
      `
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::jsonb,
        'email',
        $4,
        NOW(),
        NOW(),
        NOW()
      )
      `,
      [
        identityId,
        userId,
        JSON.stringify({ sub: userId, email }),
        email,
      ],
    );

    console.log(`Auth SQL: ${email} (id=${userId})`);
  }

  await db.query(
    `
    UPDATE profiles
    SET is_approved = TRUE,
        category_1_approved = CASE WHEN role::text = 'worker' THEN TRUE ELSE category_1_approved END,
        category_2_approved = CASE WHEN role::text = 'worker' THEN TRUE ELSE category_2_approved END
    WHERE id = ANY($1::uuid[])
    `,
    [accounts.map((a) => a.id)],
  );
}

async function ensureAuthUsers(accounts, db) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceKey && url) {
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const acc of accounts) {
      const email = emailFor(acc.phone);
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        id: acc.id,
        email,
        password: PHONE_AUTH_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: acc.full_name, role: acc.role },
      });

      if (createErr) {
        const exists =
          createErr.message?.includes('already') ||
          createErr.message?.includes('registered');
        if (exists) {
          const { error: updErr } = await admin.auth.admin.updateUserById(acc.id, {
            email,
            password: PHONE_AUTH_PASSWORD,
            email_confirm: true,
          });
          if (updErr) console.warn(`Auth update ${acc.full_name}:`, updErr.message);
          else console.log(`Auth actualizado: ${email}`);
        } else {
          console.warn(`Auth create ${acc.full_name}:`, createErr.message);
        }
      } else {
        console.log(`Auth creado: ${email} (id=${created.user?.id ?? acc.id})`);
      }
    }
    return;
  }

  if (db) {
    await ensureAuthUsersSql(db, accounts);
    return;
  }

  console.warn(
    '⚠️  Sin Auth users: necesitás SUPABASE_DB_URL o SUPABASE_SERVICE_ROLE_KEY.',
  );
}

async function tableExists(db, name) {
  const { rows } = await db.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [name],
  );
  return rows.length > 0;
}

async function truncateIfExists(db, tables) {
  const existing = [];
  for (const t of tables) {
    if (await tableExists(db, t)) existing.push(t);
  }
  if (!existing.length) return;
  await db.query(`TRUNCATE TABLE ${existing.map((t) => `"${t}"`).join(', ')} CASCADE`);
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Define SUPABASE_DB_URL en .env');
    process.exit(1);
  }

  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  console.log('Limpiando solicitudes, asignaciones y perfiles…');

  await truncateIfExists(db, [
    'job_work_photos',
    'worker_reviews',
    'job_assignments',
    'transactions',
    'jobs',
    'worker_profiles',
    'profiles',
  ]);

  try {
    await db.query('DELETE FROM auth.identities');
    await db.query('DELETE FROM auth.users');
    console.log('Auth users eliminados.');
  } catch (err) {
    console.warn('Auth.users:', err.message, '(perfiles listos para login por teléfono)');
  }

  for (const acc of ACCOUNTS) {
    const isWorker = acc.role === 'worker';
    await db.query(
      `INSERT INTO profiles (
        id, full_name, phone, email, role, is_approved,
        worker_status, category_1, category_2,
        category_1_approved, category_2_approved,
        cedula_url, record_policia_url
      ) VALUES (
        $1, $2, $3, $4, $5::user_role, $6,
        $7, $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        is_approved = EXCLUDED.is_approved,
        worker_status = EXCLUDED.worker_status,
        category_1_approved = EXCLUDED.category_1_approved,
        category_2_approved = EXCLUDED.category_2_approved`,
      [
        acc.id,
        acc.full_name,
        acc.phone,
        emailFor(acc.phone),
        acc.role,
        true,
        isWorker ? 'active' : null,
        isWorker ? 'limpieza_sofas' : null,
        isWorker ? 'jardineria' : null,
        isWorker,
        isWorker,
        isWorker ? 'pilot-bypass' : null,
        isWorker ? 'pilot-bypass' : null,
      ],
    );

    if (isWorker && (await tableExists(db, 'worker_profiles'))) {
      try {
        await db.query(
          `INSERT INTO worker_profiles (worker_id, bio, skills)
           VALUES ($1, 'Técnico de prueba CHAMBA', '{}')
           ON CONFLICT (worker_id) DO NOTHING`,
          [acc.id],
        );
      } catch (wpErr) {
        await db.query(
          `INSERT INTO worker_profiles (worker_id) VALUES ($1)
           ON CONFLICT (worker_id) DO NOTHING`,
          [acc.id],
        ).catch(() => undefined);
      }
    }
  }

  await ensureAuthUsers(ACCOUNTS, db);

  // Tras crear auth.users, el trigger de Supabase puede dejar is_approved en false
  await db.query(
    `
    UPDATE profiles SET is_approved = TRUE
    WHERE id = ANY($1::uuid[])
    `,
    [ACCOUNTS.map((a) => a.id)],
  );

  const { rows: left } = await db.query(
    `SELECT full_name, phone, role::text, is_approved FROM profiles ORDER BY role, full_name`,
  );

  await db.end();

  console.log('\n✅ Base lista con 2 cuentas:\n');
  console.table(left);
  console.log('\n── Cómo probar ──');
  console.log('Cliente:  mama papa  | +505 8888-8888 | rol Cliente');
  console.log('Técnico:  pepe pepe  | +505 8488-8888 | rol Trabajador');
  console.log(`\nContraseña Auth (teléfono): ${PHONE_AUTH_PASSWORD}`);
  console.log('Opcional: node scripts/seed-mama-open-job.mjs — solicitud open de prueba');
  console.log('En la app: cerrá sesión, borrá caché del navegador si hace falta, y volvé a entrar.\n');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
