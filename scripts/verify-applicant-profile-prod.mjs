#!/usr/bin/env node
/** Verifica migración 044 + bundle prod (npm run verify:applicant-profile) */
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

const PROD_URL = 'https://chamba-woad.vercel.app';

async function verifyBundle() {
  const htmlRes = await fetch(`${PROD_URL}/`);
  if (!htmlRes.ok) throw new Error(`HTML ${htmlRes.status}`);
  const html = await htmlRes.text();
  const m = html.match(/src="(\/_expo\/static\/js\/web\/AppEntry-[^"]+\.js)"/);
  if (!m) throw new Error('No se encontró bundle AppEntry en index.html');
  const jsRes = await fetch(`${PROD_URL}${m[1]}`);
  if (!jsRes.ok) throw new Error(`Bundle ${jsRes.status}`);
  const js = await jsRes.text();
  const needles = [
    'Ver perfil',
    'Perfil del t',
    'WorkerApplicantProfileModal',
    'p_applicant_lat',
    'captureWorkerApplicantLocation',
  ];
  const missing = needles.filter((n) => !js.includes(n));
  return { bundleUrl: m[1], missing, ok: missing.length === 0 };
}

async function verifyDb() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) return { skipped: true };

  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  try {
    const { rows: cols } = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'job_assignments'
        AND column_name IN ('applicant_lat', 'applicant_lng')
      ORDER BY 1
    `);

    const { rows: fns } = await db.query(`
      SELECT proname FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('fn_haversine_km', 'get_job_worker_applications')
      ORDER BY 1
    `);

    const { rows: openJobs } = await db.query(`
      SELECT j.id, j.created_by, j.title, j.lat, j.lng,
        (SELECT COUNT(*)::int FROM job_assignments ja
         WHERE ja.job_id = j.id AND ja.selection_status = 'pending') AS pending
      FROM jobs j
      WHERE j.status = 'open'
      ORDER BY j.created_at DESC
      LIMIT 5
    `);

    const { rows: pendingJobs } = await db.query(`
      SELECT j.id, j.created_by, j.title, COUNT(ja.id)::int AS pending
      FROM jobs j
      JOIN job_assignments ja ON ja.job_id = j.id AND ja.selection_status = 'pending'
      GROUP BY j.id, j.created_by, j.title
      ORDER BY pending DESC
      LIMIT 1
    `);

    const { rows: anyAppJob } = await db.query(`
      SELECT j.id, j.created_by, j.title
      FROM jobs j
      WHERE EXISTS (
        SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id
      )
      ORDER BY j.updated_at DESC NULLS LAST
      LIMIT 1
    `);

    let sample = null;
    const target = pendingJobs[0] ?? anyAppJob[0] ?? openJobs[0];
    if (target) {
      const { rows } = await db.query(
        'SELECT get_job_worker_applications($1::uuid, $2::uuid) AS body',
        [target.id, target.created_by],
      );
      const body = rows[0]?.body;
      const apps = body?.applications ?? [];
      sample = {
        jobId: target.id,
        jobTitle: target.title,
        pending: target.pending ?? pendingJobs[0]?.pending ?? 0,
        hasPendingJobsInDb: pendingJobs.length > 0,
        rpcSuccess: body?.success,
        appCount: apps.length,
        firstAppKeys: apps[0] ? Object.keys(apps[0]).sort() : [],
        firstApp: apps[0]
          ? {
              full_name: apps[0].full_name,
              bio: apps[0].bio ?? null,
              distance_km: apps[0].distance_km ?? null,
              worker_lat: apps[0].worker_lat ?? null,
              worker_lng: apps[0].worker_lng ?? null,
            }
          : null,
      };
    }

    return {
      skipped: false,
      columns: cols.map((r) => r.column_name),
      functions: fns.map((r) => r.proname),
      openJobsCount: openJobs.length,
      sample,
    };
  } finally {
    await db.end();
  }
}

async function main() {
  console.log('=== Verificación producción: Ver perfil postulantes ===\n');

  const bundle = await verifyBundle();
  console.log('1) Bundle Vercel:', bundle.bundleUrl);
  if (bundle.ok) {
    console.log('   ✅ Contiene: Ver perfil, modal, coords postulación\n');
  } else {
    console.log('   ❌ Faltan strings:', bundle.missing.join(', '), '\n');
  }

  const db = await verifyDb();
  if (db.skipped) {
    console.log('2) Supabase RPC: omitido (sin SUPABASE_DB_URL)\n');
  } else {
    console.log('2) Supabase migración 044');
    console.log('   Columnas:', db.columns.join(', ') || '—');
    console.log('   Funciones:', db.functions.join(', ') || '—');
    const colsOk = db.columns.includes('applicant_lat') && db.columns.includes('applicant_lng');
    const fnOk = db.functions.includes('fn_haversine_km') && db.functions.includes('get_job_worker_applications');
    console.log(colsOk && fnOk ? '   ✅ Schema OK' : '   ❌ Schema incompleto');
    if (db.sample) {
      console.log('\n3) RPC muestra (job):', db.sample.jobTitle);
      console.log('   Jobs con pending en BD:', db.sample.hasPendingJobsInDb ? 'sí' : 'no');
      console.log('   Postulaciones en RPC:', db.sample.appCount);
      console.log('   Keys postulante:', db.sample.firstAppKeys.join(', ') || '—');
      if (db.sample.firstApp) {
        console.log('   Muestra:', JSON.stringify(db.sample.firstApp, null, 2));
        const keysOk = ['bio', 'distance_km', 'worker_lat', 'worker_lng'].every((k) =>
          db.sample.firstAppKeys.includes(k),
        );
        console.log(keysOk ? '   ✅ RPC devuelve bio + distancia' : '   ❌ RPC sin campos nuevos');
      } else {
        console.log('   ℹ️ Sin postulantes en ese job — UI visible cuando haya pending');
      }
    }
    console.log('');
  }

  if (!bundle.ok) process.exit(1);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
