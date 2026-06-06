#!/usr/bin/env node
/**
 * Elimina perfiles registrados por error como "Empresa" (role=admin vía teléfono).
 * Conserva el admin piloto real (admin@chamba.com / EXPO_PUBLIC_PILOT_ADMIN_PHONE).
 *
 * npm run db:purge-fake-empresa-admins
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

const PILOT_ADMIN_EMAIL = (process.env.EXPO_PUBLIC_PILOT_ADMIN_EMAIL || 'admin@chamba.com').trim().toLowerCase();
const PILOT_ADMIN_PHONE = (process.env.EXPO_PUBLIC_PILOT_ADMIN_PHONE || '5512345678').replace(/\D/g, '');
const PILOT_ADMIN_ID = (process.env.EXPO_PUBLIC_PILOT_ADMIN_ID || '').trim();
const PHONE_DOMAIN = (process.env.EXPO_PUBLIC_PILOT_EMAIL_DOMAIN || 'phone.chamba.local').trim();

async function tableExists(db, name) {
  const { rows } = await db.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [name],
  );
  return rows.length > 0;
}

async function deleteProfileData(db, ids) {
  if (!ids.length) return;

  for (const table of ['mensajes', 'job_work_photos', 'worker_reviews']) {
    if (!(await tableExists(db, table))) continue;
    const col = table === 'mensajes' ? 'remitente_id' : table === 'worker_reviews' ? 'worker_id' : 'worker_id';
    await db.query(`DELETE FROM "${table}" WHERE ${col} = ANY($1::uuid[])`, [ids]);
  }

  if (await tableExists(db, 'job_assignments')) {
    await db.query(`DELETE FROM job_assignments WHERE worker_id = ANY($1::uuid[])`, [ids]);
  }

  if (await tableExists(db, 'jobs')) {
    await db.query(`DELETE FROM jobs WHERE created_by = ANY($1::uuid[])`, [ids]);
  }

  if (await tableExists(db, 'worker_profiles')) {
    await db.query(`DELETE FROM worker_profiles WHERE worker_id = ANY($1::uuid[])`, [ids]);
  }

  await db.query(`DELETE FROM profiles WHERE id = ANY($1::uuid[])`, [ids]);

  try {
    await db.query(`DELETE FROM auth.identities WHERE user_id = ANY($1::uuid[])`, [ids]);
    await db.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [ids]);
  } catch (err) {
    console.warn('Auth cleanup:', err.message);
  }
}

function isLegitimateAdmin(row) {
  if (PILOT_ADMIN_ID && row.id === PILOT_ADMIN_ID) return true;
  const email = (row.email || '').trim().toLowerCase();
  const phone = (row.phone || '').replace(/\D/g, '');
  if (email === PILOT_ADMIN_EMAIL) return true;
  if (phone && phone === PILOT_ADMIN_PHONE) return true;
  return false;
}

function isFakeEmpresaRegistration(row) {
  if (row.role !== 'admin') return false;
  if (isLegitimateAdmin(row)) return false;
  const email = (row.email || '').trim().toLowerCase();
  // Registro por teléfono siempre usa @phone.chamba.local
  if (email.endsWith(`@${PHONE_DOMAIN}`)) return true;
  // Cualquier otro admin que no sea el piloto
  return true;
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

  const { rows: admins } = await db.query(`
    SELECT id, full_name, phone, email, role::text AS role, is_approved, created_at
    FROM profiles
    WHERE role::text = 'admin'
    ORDER BY created_at
  `);

  console.log('\n── Admins en BD ──');
  console.table(admins);

  const toDelete = admins.filter(isFakeEmpresaRegistration);
  const toKeep = admins.filter((r) => !isFakeEmpresaRegistration(r));

  if (!toDelete.length) {
    console.log('\n✅ No hay registros falsos de Empresa/admin para eliminar.');
    await db.end();
    return;
  }

  console.log(`\nConservando ${toKeep.length} admin(s) legítimo(s):`);
  toKeep.forEach((r) => console.log(`  · ${r.full_name} (${r.phone ?? r.email})`));

  console.log(`\nEliminando ${toDelete.length} registro(s) falso(s) de Empresa:`);
  toDelete.forEach((r) => console.log(`  · ${r.full_name} | ${r.phone} | ${r.email}`));

  const ids = toDelete.map((r) => r.id);
  await deleteProfileData(db, ids);

  const { rows: after } = await db.query(`
    SELECT id, full_name, phone, email, role::text AS role
    FROM profiles
    WHERE role::text = 'admin'
    ORDER BY full_name
  `);

  await db.end();

  console.log('\n── Admins restantes ──');
  console.table(after.length ? after : [{ info: '(ninguno)' }]);
  console.log('\n✅ Listo. Esos usuarios deben registrarse de nuevo como Cliente.\n');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
