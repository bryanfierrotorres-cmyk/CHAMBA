#!/usr/bin/env node
/**
 * Prueba conexión Cliente → Job abierto → visible para técnico (Luis Papa o similar).
 * Requiere SUPABASE_DB_URL en .env (o SUPABASE_SERVICE_ROLE_KEY + URL).
 *
 * npm run test:client-worker
 * npm run test:client-worker -- papa
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const PILOT = process.env.EXPO_PUBLIC_PILOT_MODE !== 'false';
const WORKER_SEARCH = (process.argv[2] || 'luis').toLowerCase();

const ALL_CATS = [
  'limpieza_sofas', 'limpieza_alfombra', 'alfombra_institucional', 'fumigacion',
  'vehiculo_profundo', 'conserjeria_ocasional', 'conserjeria_contrato', 'jardineria',
];

function workerFeedCategories(profile) {
  if (!profile.is_approved) return [];
  const cats = [];
  if (profile.category_1 && profile.category_1_approved) cats.push(profile.category_1);
  if (profile.category_2 && profile.category_2_approved) cats.push(profile.category_2);
  if (cats.length === 0 && PILOT) return [...ALL_CATS];
  return cats;
}

const log = (m) => console.log(m);
const fail = (m) => { console.error(`\n❌ ${m}`); process.exit(1); };

async function main() {
  if (!dbUrl) fail('Define SUPABASE_DB_URL en .env');

  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  log('═══════════════════════════════════════════════════');
  log('  TEST: Cliente publica → Técnico ve en feed');
  log('═══════════════════════════════════════════════════\n');

  const { rows: workers } = await db.query(
    `SELECT id, full_name, phone, is_approved,
            category_1, category_1_approved, category_2, category_2_approved
     FROM profiles
     WHERE role::text = 'worker'
       AND lower(full_name) LIKE $1
     ORDER BY full_name LIMIT 5`,
    [`%${WORKER_SEARCH}%`],
  );

  const worker = workers[0];
  if (!worker) fail(`No hay técnico con nombre ~"${WORKER_SEARCH}"`);

  log(`Técnico: ${worker.full_name}`);
  log(`  is_approved: ${worker.is_approved}`);
  log(`  categorías: ${worker.category_1}(${worker.category_1_approved}), ${worker.category_2}(${worker.category_2_approved})`);
  log(`  modo piloto: ${PILOT}`);

  const feedCats = workerFeedCategories(worker);
  if (feedCats.length === 0) {
    await db.end();
    fail('Sin categorías en feed — activá is_approved y categorías en Supabase');
  }
  const jobCategory = feedCats.includes('limpieza_sofas') ? 'limpieza_sofas' : feedCats[0];
  log(`  Publicando en categoría: ${jobCategory}\n`);

  const { rows: clients } = await db.query(
    `SELECT id, full_name, phone FROM profiles
     WHERE role::text = 'client'
     ORDER BY created_at DESC NULLS LAST LIMIT 5`,
  );
  if (!clients.length) {
    await db.end();
    fail('No hay clientes en profiles');
  }
  const client = clients[0];
  log(`Cliente: ${client.full_name} (${client.phone ?? 'sin tel'})\n`);

  const RUN = Date.now().toString(36);
  const title = `Test conexión ${RUN}`;

  const { rows: rpcRows } = await db.query(
    `SELECT create_client_job(
      $1::uuid, $2, $3, $4, $5::numeric, $6, $7::float8, $8::float8,
      2::numeric, 1, NULL, '{}'::text[]
    ) AS result`,
    [
      client.id,
      title,
      'Prueba automática cliente→técnico CHAMBA.',
      jobCategory,
      1200,
      'Managua, Altamira',
      12.1328,
      -86.2504,
    ],
  );

  const result = rpcRows[0]?.result;
  if (!result?.success) {
    await db.end();
    fail(result?.error ?? 'create_client_job falló');
  }

  const job = result.job;
  log(`✓ Job creado: ${job.id}`);
  log(`  título: ${job.title}`);
  log(`  status: ${job.status}`);
  log(`  category: ${job.category}\n`);

  const { rows: feed } = await db.query(
    `SELECT id, title, category::text, status::text, created_at
     FROM jobs
     WHERE status::text = 'open'
       AND category::text = ANY($1::text[])
     ORDER BY created_at DESC
     LIMIT 25`,
    [feedCats],
  );

  const visible = feed.some((j) => j.id === job.id);
  if (!visible) {
    await db.end();
    fail('Job no aparece en consulta de feed del técnico');
  }

  log(`✓ Visible en feed (${feed.length} jobs abiertos en categorías del técnico):`);
  feed.slice(0, 6).forEach((j) => {
    log(`   · ${j.title} [${j.category}]${j.id === job.id ? ' ← NUEVO' : ''}`);
  });

  const { rows: pol } = await db.query(
    `SELECT policyname FROM pg_policies WHERE tablename = 'jobs' AND policyname LIKE '%worker%'`,
  );
  log(`\nRLS worker: ${pol.map((p) => p.policyname).join(', ') || 'NINGUNA (ejecutá migración 015)'}`);

  await db.end();

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  [CONEXIÓN OK] Cliente → BD → Feed técnico');
  console.log('═══════════════════════════════════════════════════');
  console.log(`\nEn la app (Luis Papa / ${worker.full_name}): Radar Activo`);
  console.log(`Buscar: "${title}"\n`);
}

main().catch((e) => {
  console.error('\n❌', e.message);
  process.exit(1);
});
