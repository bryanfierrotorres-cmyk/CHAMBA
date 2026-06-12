#!/usr/bin/env node
/** Crea usuario admin en Supabase Auth + profiles */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

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

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) { console.error('Falta SUPABASE_DB_URL'); process.exit(1); }

const ADMIN_EMAIL = 'admin@chamba.com';
const ADMIN_PASSWORD = 'Admin2026!';
const ADMIN_NAME = 'Admin CHAMBA';
const ADMIN_PHONE = '80000001';
const userId = randomUUID();

async function main() {
  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await db.connect();

    // Verificar si ya existe un admin con ese email
    const { rows: existingProfile } = await db.query(
      'SELECT id FROM profiles WHERE email = $1',
      [ADMIN_EMAIL]
    );

    let adminId = userId;

    if (existingProfile.length > 0) {
      adminId = existingProfile[0].id;
      // Actualizar perfil existente a admin
      await db.query(`
        UPDATE profiles SET role = 'admin', is_approved = true, full_name = $2, phone = $3, updated_at = now()
        WHERE id = $1
      `, [adminId, ADMIN_NAME, ADMIN_PHONE]);
      console.log('↩️  Perfil existente actualizado a admin');
    } else {
      // Crear nuevo perfil admin
      await db.query(`
        INSERT INTO profiles (id, email, full_name, phone, role, is_approved, worker_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'admin', true, null, now(), now())
      `, [adminId, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PHONE]);
    }

    // Verificar si ya existe en auth.users
    const { rows: existingAuth } = await db.query(
      'SELECT id FROM auth.users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (existingAuth.length > 0) {
      // Actualizar password
      await db.query(`
        UPDATE auth.users SET
          encrypted_password = crypt($2, gen_salt('bf')),
          email_confirmed_at = now(),
          updated_at = now(),
          raw_user_meta_data = $3::jsonb
        WHERE id = $1
      `, [
        existingAuth[0].id,
        ADMIN_PASSWORD,
        JSON.stringify({ full_name: ADMIN_NAME, role: 'admin', phone: ADMIN_PHONE }),
      ]);
      adminId = existingAuth[0].id;
      console.log('↩️  Usuario auth existente actualizado');
    } else {
      // Crear usuario auth
      await db.query(`
        INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, email_confirmed_at,
          raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
          $1, '00000000-0000-0000-0000-000000000000', $2, crypt($3, gen_salt('bf')), now(),
          $4::jsonb, now(), now(), 'authenticated', 'authenticated'
        )
      `, [
        adminId,
        ADMIN_EMAIL,
        ADMIN_PASSWORD,
        JSON.stringify({ full_name: ADMIN_NAME, role: 'admin', phone: ADMIN_PHONE }),
      ]);

      // Crear identity si no existe
      const { rows: existingIdentity } = await db.query(
        'SELECT id FROM auth.identities WHERE user_id = $1',
        [adminId]
      );
      if (existingIdentity.length === 0) {
        await db.query(`
          INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $1, $2::jsonb, 'email', now(), now(), now())
        `, [adminId, JSON.stringify({ sub: adminId, email: ADMIN_EMAIL, email_verified: true, phone: '' })]);
      }
    }

    console.log('');
    console.log('✅ Usuario admin creado/actualizado exitosamente');
    console.log('');
    console.log('📧 Email:    ' + ADMIN_EMAIL);
    console.log('🔑 Password: ' + ADMIN_PASSWORD);
    console.log('🆔 User ID:  ' + adminId);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
