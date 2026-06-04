#!/usr/bin/env node
/**
 * ¿Pepe ve todas las subcategorías de Limpieza + Jardinería en el feed?
 * npm run diagnose:pepe-limpieza
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

// Réplica mínima de Express + mapeo DB (alineado con workerCategoryAccess + chambaCategories)
const EXPRESS_SUB_TILES = {
  limpieza: [
    { slug: 'limpieza_sofas' },
    { slug: 'limpieza_banos' },
    { slug: 'conserjeria_ocasional' },
    { slug: 'limpieza_alfombra' },
  ],
  jardineria: [
    { slug: 'jardineria_corte' },
    { slug: 'jardineria_poda' },
    { slug: 'jardineria_patio' },
    { slug: 'jardineria' },
  ],
};
const EXPRESS_MAIN = [
  { id: 'limpieza', submenu: 'limpieza' },
  { id: 'jardineria', submenu: 'jardineria' },
];
const DB_MAP = {
  limpieza_sofas: 'sofas',
  limpieza_alfombra: 'alfombra',
};
const LEGACY = { sofas: 'limpieza_sofas', alfombra: 'limpieza_alfombra', limpieza: 'limpieza_alfombra' };

const fromDb = (c) => LEGACY[c] ?? c;
const toDbQuery = (cat) => {
  const primary = DB_MAP[cat] ?? cat;
  const extras = {
    limpieza_sofas: ['sofas'],
    limpieza_alfombra: ['alfombra', 'limpieza'],
    jardineria: ['jardineria_corte', 'jardineria_poda', 'jardineria_patio'],
  }[cat] ?? [];
  const out = new Set([primary, ...extras, cat]);
  if (String(cat).startsWith('jardineria_')) out.add('jardineria');
  return [...out];
};

function family(slug) {
  const n = fromDb(slug) ?? slug;
  const out = new Set([n]);
  const main = EXPRESS_MAIN.find((t) => t.id === n);
  if (main?.submenu) {
    EXPRESS_SUB_TILES[main.submenu].forEach((t) => out.add(t.slug));
    out.add(main.id);
    return [...out];
  }
  for (const [menu, tiles] of Object.entries(EXPRESS_SUB_TILES)) {
    if (tiles.some((t) => t.slug === n)) {
      tiles.forEach((t) => out.add(t.slug));
      const meta = EXPRESS_MAIN.find((m) => m.submenu === menu);
      if (meta) out.add(meta.id);
      return [...out];
    }
  }
  return [...out];
}

function feedCats(pepe) {
  const specs = [];
  if (pepe.category_1 && pepe.category_1_approved) specs.push(fromDb(pepe.category_1) ?? pepe.category_1);
  if (pepe.category_2 && pepe.category_2_approved) specs.push(fromDb(pepe.category_2) ?? pepe.category_2);
  const out = new Set();
  specs.forEach((s) => family(s).forEach((x) => out.add(x)));
  return [...out];
}

function dbFilter(cats) {
  const out = new Set();
  cats.forEach((c) => toDbQuery(c).forEach((v) => out.add(v)));
  return [...out];
}

async function main() {
  const pg = await import('pg');
  const db = new pg.default.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const { rows: [pepe] } = await db.query(`
    SELECT category_1, category_2, category_1_approved, category_2_approved, is_approved
    FROM profiles WHERE phone = '84888888' LIMIT 1
  `);
  if (!pepe) {
    console.log('Pepe no encontrado');
    await db.end();
    return;
  }

  const appCats = feedCats(pepe);
  const dbVals = dbFilter(appCats);

  console.log('\n=== PEPE — especialidades ===');
  console.log('cat1:', pepe.category_1, 'aprobada:', pepe.category_1_approved);
  console.log('cat2:', pepe.category_2, 'aprobada:', pepe.category_2_approved);
  console.log('\nSlugs en feed (app):', appCats.join(', '));
  console.log('\nValores en query SQL:', dbVals.join(', '));

  const LIMPIEZA_SLUGS = [
    'limpieza', 'limpieza_sofas', 'limpieza_banos', 'limpieza_alfombra', 'conserjeria_ocasional',
    'sofas', 'alfombra', 'limpieza',
  ];

  console.log('\n=== Cobertura Limpieza Express ===');
  for (const s of LIMPIEZA_SLUGS) {
    const ok = appCats.includes(s) || appCats.includes(fromDb(s));
    const dbOk = dbVals.includes(s) || dbVals.includes(fromDb(s) ?? s);
    console.log(`  ${s}: app=${ok ? 'SÍ' : 'NO'} | sql=${dbOk ? 'SÍ' : 'NO'}`);
  }

  const { rows: jobs } = await db.query(`
    SELECT title, category::text AS cat, status::text
    FROM jobs WHERE status::text = 'open' ORDER BY created_at DESC LIMIT 20
  `);

  console.log('\n=== Jobs abiertos vs Pepe ===');
  for (const j of jobs) {
    const norm = fromDb(j.cat) ?? j.cat;
    const visible = appCats.includes(norm) || appCats.includes(j.cat) || dbVals.includes(j.cat);
    console.log(`  ${visible ? '✓' : '✗'} [${j.cat}] ${j.title}`);
  }

  const { data: rpcTest } = await (async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } },
    );
    const { data } = await client.rpc('get_worker_open_jobs_feed', {
      p_worker_id: '11111111-1111-1111-1111-111111111102',
      p_status: 'open',
      p_categories: dbVals,
      p_limit: 30,
      p_offset: 0,
    });
    return data;
  })();

  if (rpcTest?.success) {
    console.log(`\nRPC feed (filtrado): ${(rpcTest.jobs ?? []).length} jobs`);
    for (const j of rpcTest.jobs ?? []) {
      console.log(`  · [${j.category}] ${j.title}`);
    }
  }

  await db.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
