#!/usr/bin/env node
/**
 * Elimina todos los perfiles client/worker y sus datos operativos.
 * Conserva cuentas admin. No recrea usuarios de prueba.
 *
 * npm run db:purge-client-workers
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
  await db.query(`TRUNCATE TABLE ${existing.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
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

  const { rows: before } = await db.query(`
    SELECT id, full_name, phone, role::text AS role
    FROM profiles
    ORDER BY role, full_name
  `);
  console.log('\n── Perfiles antes ──');
  console.table(before);

  const { rows: targetRows } = await db.query(`
    SELECT id, full_name, role::text AS role
    FROM profiles
    WHERE role::text IN ('client', 'worker')
  `);
  const targetIds = targetRows.map((r) => r.id);

  if (!targetIds.length) {
    console.log('\n✅ No hay clientes ni técnicos que eliminar.');
    await db.end();
    return;
  }

  console.log(`\nEliminando ${targetIds.length} perfil(es) client/worker y datos vinculados…`);

  // Datos operativos (CASCADE desde jobs/mensajes según migraciones)
  await truncateIfExists(db, [
    'mensajes',
    'job_work_photos',
    'worker_reviews',
    'job_assignments',
    'transactions',
    'jobs',
  ]);

  if (await tableExists(db, 'worker_profiles')) {
    await db.query(
      `DELETE FROM worker_profiles WHERE worker_id = ANY($1::uuid[])`,
      [targetIds],
    );
  }

  await db.query(`DELETE FROM profiles WHERE id = ANY($1::uuid[])`, [targetIds]);

  // Auth: solo usuarios eliminados (conservar admin)
  try {
    await db.query(
      `DELETE FROM auth.identities WHERE user_id = ANY($1::uuid[])`,
      [targetIds],
    );
    await db.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [targetIds]);
    console.log('Auth users client/worker eliminados.');
  } catch (err) {
    console.warn('Auth cleanup:', err.message);
  }

  const { rows: after } = await db.query(`
    SELECT id, full_name, phone, role::text AS role
    FROM profiles
    ORDER BY role, full_name
  `);

  await db.end();

  console.log('\n── Perfiles restantes ──');
  console.table(after.length ? after : [{ info: '(ninguno — solo admin u otros roles)' }]);
  console.log('\n✅ Listo. Podés registrar clientes y técnicos nuevos desde la app.');
  console.log('   Cerrá sesión en la app y limpiá caché del navegador si seguís logueado.\n');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
