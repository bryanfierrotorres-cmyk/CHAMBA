#!/usr/bin/env node
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

const PILOT = process.env.EXPO_PUBLIC_PILOT_MODE !== 'false';
const ALL_CATS = [
  'limpieza_sofas', 'limpieza_alfombra', 'alfombra_institucional', 'fumigacion',
  'vehiculo_profundo', 'conserjeria_ocasional', 'conserjeria_contrato', 'jardineria',
  'limpieza', 'ac', 'car', 'grama', 'pet', 'vehiculos', 'alfombra', 'sofas',
];

function feedCategories(w) {
  if (!w.is_approved) return { cats: [], reason: 'is_approved = false' };
  const cats = [];
  if (w.category_1 && w.category_1_approved) cats.push(w.category_1);
  if (w.category_2 && w.category_2_approved) cats.push(w.category_2);
  if (cats.length === 0 && PILOT) return { cats: [...ALL_CATS], reason: 'piloto: todas las categorías' };
  if (cats.length === 0) return { cats: [], reason: 'sin categorías aprobadas' };
  return { cats, reason: 'categorías aprobadas en perfil' };
}

function norm(s) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

async function main() {
  const pg = await import('pg');
  const db = new pg.default.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const { rows: profiles } = await db.query(`
    SELECT id, full_name, phone, role::text, is_approved,
           category_1, category_1_approved, category_2, category_2_approved,
           created_at
    FROM profiles
    WHERE lower(full_name) LIKE '%marcela%'
       OR lower(full_name) LIKE '%escoto%'
       OR lower(full_name) LIKE '%luis%'
       OR lower(full_name) LIKE '%papa%'
    ORDER BY role, full_name
  `);

  console.log('\n=== PERFILES RELACIONADOS ===\n');
  console.table(profiles.map((p) => ({
    nombre: p.full_name,
    rol: p.role,
    tel: p.phone,
    aprobado: p.is_approved,
    id: p.id.slice(0, 8) + '…',
  })));

  const clients = profiles.filter(
    (p) => p.role === 'client' && (norm(p.full_name).includes('marcela') || norm(p.full_name).includes('escoto')),
  );
  const workers = profiles.filter(
    (p) => p.role === 'worker' && (norm(p.full_name).includes('luis') || norm(p.full_name).includes('papa')),
  );

  const marcela = clients.find((p) => norm(p.full_name).includes('marcela')) ?? clients[0];
  const luisPapaAny = profiles.find((p) => norm(p.full_name) === 'luis papa');
  const luis = workers.find((p) => norm(p.full_name).includes('luis') && norm(p.full_name).includes('papa'))
    ?? workers.find((p) => norm(p.full_name).includes('luis'))
    ?? workers[0];

  if (luisPapaAny) {
    console.log('\n=== LUIS PAPA (exacto) ===\n');
    console.log(`  rol en BD: ${luisPapaAny.role}  (debe ser "worker" para ver Radar)`);
    console.log(`  tel: ${luisPapaAny.phone}  id: ${luisPapaAny.id}`);
    if (luisPapaAny.role !== 'worker') {
      console.log('  ⚠ Si inicia sesión como Trabajador con este número, la app puede mezclar perfiles.');
    }
  }

  if (!marcela) {
    console.log('\n⚠ No encontré cliente "Marcela Escoto". Todos los clientes escoto/marcela:');
    profiles.filter((p) => p.role === 'client').forEach((p) => console.log(' -', p.full_name, p.phone));
  }
  if (!luis) {
    console.log('\n⚠ No encontré técnico "Luis Papa". Técnicos luis/papa:');
    profiles.filter((p) => p.role === 'worker').forEach((p) => console.log(' -', p.full_name, p.phone));
  }

  if (marcela) {
    console.log('\n=== JOBS DE MARCELA (últimos 15) ===\n');
    const { rows: jobs } = await db.query(
      `SELECT id, title, category::text, status::text, created_at, created_by
       FROM jobs WHERE created_by = $1 ORDER BY created_at DESC LIMIT 15`,
      [marcela.id],
    );
    if (!jobs.length) {
      console.log('(ningún job con created_by =', marcela.id, ')');
      const { rows: byPhone } = await db.query(
        `SELECT j.id, j.title, j.category::text, j.status::text, j.created_by, p.full_name AS creator
         FROM jobs j LEFT JOIN profiles p ON p.id = j.created_by
         WHERE lower(p.full_name) LIKE '%marcela%' OR lower(p.full_name) LIKE '%escoto%'
         ORDER BY j.created_at DESC LIMIT 15`,
      );
      console.table(byPhone);
    } else {
      console.table(jobs.map((j) => ({
        titulo: (j.title ?? '').slice(0, 40),
        categoria: j.category,
        estado: j.status,
        fecha: j.created_at?.toISOString?.()?.slice(0, 16) ?? j.created_at,
      })));
    }
  }

  if (luis) {
    const { cats, reason } = feedCategories(luis);
    console.log('\n=== FEED DE LUIS PAPA ===\n');
    console.log('Perfil:', luis.full_name, '| tel:', luis.phone);
    console.log('Aprobado:', luis.is_approved, '| Feed:', reason);
    console.log('Categorías visibles:', cats.length ? cats.slice(0, 8).join(', ') + (cats.length > 8 ? '…' : '') : '(ninguna)');

    const openJobs = marcela
      ? (await db.query(
          `SELECT id, title, category::text, status::text FROM jobs
           WHERE created_by = $1 AND status::text = 'open' ORDER BY created_at DESC`,
          [marcela.id],
        )).rows
      : [];

    if (openJobs.length && cats.length) {
      console.log('\n¿Marcela (open) visible para Luis?\n');
      for (const j of openJobs) {
        const match = cats.includes(j.category);
        console.log(`  ${match ? '✓' : '✗'} [${j.category}] ${(j.title ?? '').slice(0, 50)}`);
        if (!match) {
          console.log(`      → categoría del job NO está en feed del técnico`);
        }
      }
    }

    if (cats.length) {
      const { rows: feed } = await db.query(
        `SELECT COUNT(*)::int AS n FROM jobs WHERE status::text = 'open' AND category::text = ANY($1::text[])`,
        [cats],
      );
      console.log('\nTotal jobs abiertos en categorías de Luis:', feed[0].n);
    }
  }

  // Duplicados por teléfono
  console.log('\n=== DUPLICADOS POR TELÉFONO (mismo número, distinto id) ===\n');
  const { rows: dups } = await db.query(`
    SELECT phone, array_agg(full_name || ' (' || role::text || ')' ORDER BY full_name) AS perfiles,
           count(*)::int AS n, array_agg(id::text) AS ids
    FROM profiles WHERE phone IS NOT NULL AND phone <> ''
    GROUP BY phone HAVING count(*) > 1
  `);
  if (dups.length) console.table(dups);
  else console.log('(ninguno)');

  // Jobs open recientes de cualquier escoto
  console.log('\n=== ÚLTIMOS JOBS ABIERTOS (cualquier cliente) ===\n');
  const { rows: recent } = await db.query(`
    SELECT j.title, j.category::text, j.status::text, p.full_name AS cliente
    FROM jobs j JOIN profiles p ON p.id = j.created_by
    WHERE j.status::text = 'open'
    ORDER BY j.created_at DESC LIMIT 8
  `);
  console.table(recent);

  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
