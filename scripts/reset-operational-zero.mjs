#!/usr/bin/env node
/**
 * Borra TODAS las solicitudes/chambas operativas y deja cuentas intactas.
 * Conserva perfiles (clientes, técnicos, admin). Resetea métricas de worker_profiles.
 *
 * npm run db:reset-operational-zero
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
  if (!existing.length) return [];
  await db.query(`TRUNCATE TABLE ${existing.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  return existing;
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

  const { rows: countsBefore } = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM jobs) AS jobs,
      (SELECT COUNT(*)::int FROM job_assignments) AS assignments,
      (SELECT COUNT(*)::int FROM profiles WHERE role::text IN ('client', 'worker')) AS users
  `);
  console.log('\n── Antes ──');
  console.table(countsBefore);

  console.log('\n🧹 Limpiando solicitudes, asignaciones, chat y billetera operativa…');
  const truncated = await truncateIfExists(db, [
    'mensajes',
    'job_work_photos',
    'worker_reviews',
    'job_assignments',
    'transactions',
    'jobs',
  ]);
  console.log('Tablas truncadas:', truncated.join(', ') || '(ninguna)');

  if (await tableExists(db, 'worker_profiles')) {
    await db.query(`
      UPDATE worker_profiles
      SET total_jobs_done = 0,
          total_reviews = 0,
          rating_avg = NULL
    `);
    console.log('✅ worker_profiles: métricas en cero');
  }

  const { rows: countsAfter } = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM jobs) AS jobs,
      (SELECT COUNT(*)::int FROM job_assignments) AS assignments,
      (SELECT COUNT(*)::int FROM profiles WHERE role::text = 'client') AS clients,
      (SELECT COUNT(*)::int FROM profiles WHERE role::text = 'worker') AS workers
  `);

  const { rows: profiles } = await db.query(`
    SELECT full_name, phone, role::text AS role, is_approved
    FROM profiles
    WHERE role::text IN ('client', 'worker', 'admin')
    ORDER BY role, full_name
  `);

  await db.end();

  console.log('\n── Después ──');
  console.table(countsAfter);
  console.log('\n── Cuentas conservadas ──');
  console.table(profiles);

  console.log('\n✅ Canal operativo en cero. Todos empiezan desde 0.');
  console.log('   En la app: cerrá sesión o ejecutá npm run repair:browser-storage');
  console.log('   (limpia caché local de agenda/billetera en el navegador).\n');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
