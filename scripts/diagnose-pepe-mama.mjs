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

function pepeFeedCats(w) {
  if (!w.is_approved) return { cats: [], note: 'is_approved=false en BD' };
  const cats = [];
  if (w.category_1 && w.category_1_approved) cats.push(w.category_1);
  if (w.category_2 && w.category_2_approved) cats.push(w.category_2);
  if (cats.length === 0 && PILOT) return { cats: ['*piloto-todas*'], note: 'sin cat → piloto ve todo' };
  return { cats, note: 'filtro por categorías del perfil' };
}

function dbQueryValues(appCat) {
  const map = {
    limpieza_sofas: ['sofas'],
    limpieza_alfombra: ['alfombra', 'limpieza'],
    vehiculo_profundo: ['vehiculos'],
    jardineria: ['jardineria'],
  };
  const extras = map[appCat] ?? [];
  const primary = appCat === 'jardineria' ? 'jardineria' : extras[0] ?? appCat;
  return [primary, ...extras.filter((x) => x !== primary)];
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('Sin SUPABASE_DB_URL');
    process.exit(1);
  }
  const pg = await import('pg');
  const db = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const { rows: profiles } = await db.query(`
    SELECT id, full_name, phone, role::text, is_approved,
           category_1, category_1_approved, category_2, category_2_approved
    FROM profiles
    WHERE phone IN ('88888888','84888888')
       OR lower(full_name) LIKE '%mama%'
       OR lower(full_name) LIKE '%pepe%'
    ORDER BY role
  `);

  console.log('\n=== PERFILES mama / pepe ===\n');
  console.table(profiles);

  const mama = profiles.find((p) => p.role === 'client');
  const pepe = profiles.find((p) => p.role === 'worker');
  if (!mama || !pepe) {
    console.log('Falta mama o pepe en BD');
    await db.end();
    return;
  }

  const { cats, note } = pepeFeedCats(pepe);
  console.log(`\nPepe (${note}):`, cats.join(', ') || '(ninguna)');

  const { rows: jobs } = await db.query(
    `SELECT id, title, category::text AS cat, status::text, created_at
     FROM jobs WHERE created_by = $1 ORDER BY created_at DESC LIMIT 12`,
    [mama.id],
  );

  console.log('\n=== Últimos jobs de mama ===\n');
  if (!jobs.length) {
    console.log('(ningún job publicado por mama)');
  } else {
    for (const j of jobs) {
      let visible = false;
      let reason = '';
      if (j.status !== 'open') {
        reason = `status=${j.status} (no aparece en Radar)`;
      } else if (cats[0] === '*piloto-todas*') {
        visible = true;
        reason = 'piloto sin filtro';
      } else {
        const dbVals = new Set();
        for (const c of cats) {
          for (const v of dbQueryValues(c)) dbVals.add(v);
        }
        visible = dbVals.has(j.cat) || cats.includes(j.cat);
        reason = visible
          ? 'categoría coincide con filtro Pepe'
          : `categoría "${j.cat}" NO está en filtro [${[...dbVals].join(', ')}] ni en [${cats.join(', ')}]`;
      }
      console.log(`· ${j.title} [${j.cat}] ${j.status} → ${visible ? 'SÍ visible' : 'NO visible'} (${reason})`);
    }
  }

  const { rows: pol } = await db.query(
    `SELECT policyname FROM pg_policies WHERE tablename = 'jobs' AND policyname LIKE '%worker%'`,
  );
  console.log('\nRLS worker:', pol.map((p) => p.policyname).join(', ') || 'FALTA migración 015');

  await db.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
