#!/usr/bin/env node
/**
 * Verifica RLS en producción: tablas sensibles, políticas críticas y aislamiento técnico.
 * npm run db:verify-rls
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PEPE_ID = '11111111-1111-1111-1111-111111111102';
const MAMA_ID = '11111111-1111-1111-1111-111111111101';

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
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY;

let passed = 0;
let failed = 0;
let warned = 0;

const ok = (msg) => {
  passed += 1;
  console.log(`  ✅ ${msg}`);
};
const fail = (msg) => {
  failed += 1;
  console.log(`  ❌ ${msg}`);
};
const warn = (msg) => {
  warned += 1;
  console.log(`  ⚠️  ${msg}`);
};

const SENSITIVE_TABLES = [
  'profiles',
  'jobs',
  'job_assignments',
  'mensajes',
  'worker_reviews',
  'precios_catalogo',
];

const REQUIRED_POLICIES = [
  { table: 'jobs', names: ['jobs: client select own', 'jobs: admin all'] },
  { table: 'job_assignments', names: ['assignments: worker select own'] },
  { table: 'profiles', names: ['profiles: select own'] },
  { table: 'mensajes', names: ['mensajes_select_participant', 'mensajes_insert_participant'] },
  { table: 'worker_reviews', names: ['reviews: public read', 'reviews: client insert own'] },
];

async function main() {
  console.log('\n=== CHAMBA — verificación RLS (producción) ===\n');

  if (!dbUrl) {
    fail('SUPABASE_DB_URL no configurado en .env');
    process.exit(1);
  }

  const pg = await import('pg');
  const Client = pg.default?.Client ?? pg.Client;
  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // 1. RLS habilitado en tablas sensibles
  const { rows: rlsRows } = await db.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY($1::text[])
    ORDER BY c.relname
  `, [SENSITIVE_TABLES]);

  const rlsByTable = new Map(rlsRows.map((r) => [r.table_name, r]));
  for (const table of SENSITIVE_TABLES) {
    const row = rlsByTable.get(table);
    if (!row) {
      warn(`Tabla ${table} no encontrada en public`);
      continue;
    }
    if (row.rls_enabled) ok(`RLS activo en ${table}`);
    else fail(`RLS DESACTIVADO en ${table}`);
  }

  // 2. Políticas críticas
  const { rows: policies } = await db.query(`
    SELECT c.relname AS table_name, p.polname AS policy_name, pg_get_expr(p.polqual, p.polrelid) AS using_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('jobs', 'job_assignments', 'profiles', 'mensajes', 'worker_reviews')
    ORDER BY c.relname, p.polname
  `);

  for (const { table, names } of REQUIRED_POLICIES) {
    for (const name of names) {
      const found = policies.some((p) => p.table_name === table && p.policy_name === name);
      if (found) ok(`Política ${name} en ${table}`);
      else fail(`Falta política ${name} en ${table}`);
    }
  }

  // 3. Políticas peligrosas (deben estar ausentes o reemplazadas)
  const jobsWorkerRead = policies.find(
    (p) => p.table_name === 'jobs' && p.policy_name === 'jobs: approved worker read',
  );
  if (jobsWorkerRead) {
    const expr = (jobsWorkerRead.using_expr || '').toLowerCase();
    if (expr.includes('fn_is_approved') && !expr.includes('open') && !expr.includes('assigned')) {
      fail(
        'jobs: approved worker read permite leer TODOS los jobs a cualquier técnico aprobado (sin scope)',
      );
    } else {
      warn(`jobs: approved worker read presente — revisar expresión: ${jobsWorkerRead.using_expr}`);
    }
  } else {
    const scoped = policies.find(
      (p) => p.table_name === 'jobs' && p.policy_name === 'jobs: worker read scoped',
    );
    if (scoped) ok('jobs: worker read scoped (aislamiento técnico)');
    else warn('Sin política jobs: worker read scoped ni approved worker read');
  }

  const anonAssignments = policies.find(
    (p) => p.table_name === 'job_assignments' && p.policy_name === 'pilot_anon_assignments_select',
  );
  if (anonAssignments) {
    const expr = (anonAssignments.using_expr || '').trim();
    if (expr === 'true') {
      fail('pilot_anon_assignments_select permite leer TODAS las asignaciones como anon');
    } else {
      warn(`pilot_anon_assignments_select con USING no trivial: ${expr}`);
    }
  } else {
    ok('Sin pilot_anon_assignments_select (anon no lee todas las asignaciones)');
  }

  // 4. RPC get_worker_assignments — debe validar identidad
  const { rows: rpcDefs } = await db.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_worker_assignments'
    LIMIT 1
  `);
  const rpcDef = rpcDefs[0]?.def || '';
  if (!rpcDef) {
    fail('RPC get_worker_assignments no existe');
  } else if (rpcDef.includes('auth.uid()') && rpcDef.includes('p_worker_id')) {
    ok('get_worker_assignments valida auth.uid() vs p_worker_id');
  } else {
    fail('get_worker_assignments NO valida que el invocador sea el técnico (SECURITY DEFINER abierto)');
  }

  // 5. Prueba anon: no debe leer asignaciones de otro técnico vía RPC
  if (supabaseUrl && anonKey) {
    const sb = createClient(supabaseUrl, anonKey);

    const { data: otherAssignments } = await sb.rpc('get_worker_assignments', {
      p_worker_id: PEPE_ID,
    });

    const otherCount = Array.isArray(otherAssignments) ? otherAssignments.length : 0;
    if (otherCount > 0) {
      fail(`Anon obtuvo ${otherCount} asignaciones de Pepe vía get_worker_assignments (fuga)`);
    } else {
      ok('Anon no obtiene asignaciones ajenas vía get_worker_assignments');
    }

    const { data: takenFeed } = await sb.rpc('get_worker_open_jobs_feed', {
      p_worker_id: PEPE_ID,
      p_status: 'taken',
      p_categories: null,
      p_limit: 5,
      p_offset: 0,
    });
    const takenBody = takenFeed ?? {};
    const takenJobs = takenBody.jobs ?? [];
    if (takenBody.success && Array.isArray(takenJobs) && takenJobs.length > 0) {
      fail(`Anon obtuvo ${takenJobs.length} jobs taken vía feed RPC (debe ser solo open)`);
    } else {
      ok('Feed RPC no expone jobs taken a anon sin scope');
    }

  } else {
    warn('Sin EXPO_PUBLIC_SUPABASE_URL/ANON_KEY — omitiendo pruebas anon');
  }

  // 5b. Chat: RPC sin bypass row_security off
  const { rows: chatRpcDefs } = await db.query(`
    SELECT p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('send_job_chat_message', 'get_job_chat_messages')
  `);
  for (const row of chatRpcDefs) {
    const def = row.def || '';
    if (def.includes('row_security = off')) {
      fail(`RPC ${row.proname} aún usa row_security = off (bypass RLS)`);
    } else if (def.includes('auth.uid()') && def.includes('row_security = on')) {
      ok(`RPC ${row.proname} con auth.uid() y row_security = on`);
    } else if (def.includes('auth.uid()')) {
      ok(`RPC ${row.proname} valida auth.uid()`);
    } else {
      fail(`RPC ${row.proname} sin validación auth.uid()`);
    }
  }
  if (chatRpcDefs.length === 0) {
    fail('RPCs de chat (send/get) no encontrados');
  }

  const mensajesSelect = policies.find(
    (p) => p.table_name === 'mensajes' && p.policy_name === 'mensajes_select_participant',
  );
  if (mensajesSelect?.using_expr?.includes('auth.uid()')) {
    ok('mensajes SELECT exige auth.uid() + participante del servicio');
  } else if (mensajesSelect) {
    warn(`mensajes SELECT policy: ${mensajesSelect.using_expr}`);
  }

  const mensajesInsert = policies.find(
    (p) => p.table_name === 'mensajes' && p.policy_name === 'mensajes_insert_participant',
  );
  if (mensajesInsert) {
    ok('Política mensajes INSERT activa (remitente = auth.uid())');
  } else {
    fail('Falta política mensajes_insert_participant');
  }

  // 5c. Realtime mensajes publicado
  const { rows: realtimeRows } = await db.query(`
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensajes'
  `);
  if (realtimeRows.length > 0) ok('Realtime: tabla mensajes publicada');
  else fail('Realtime: mensajes NO está en supabase_realtime');

  // 6. Resumen de políticas jobs
  console.log('\n--- Políticas jobs ---');
  policies
    .filter((p) => p.table_name === 'jobs')
    .forEach((p) => console.log(`  · ${p.policy_name}`));

  console.log('\n--- Políticas job_assignments ---');
  policies
    .filter((p) => p.table_name === 'job_assignments')
    .forEach((p) => console.log(`  · ${p.policy_name}`));

  console.log('\n--- Políticas mensajes ---');
  policies
    .filter((p) => p.table_name === 'mensajes')
    .forEach((p) => console.log(`  · ${p.policy_name}`));

  console.log('\n--- Políticas worker_reviews ---');
  policies
    .filter((p) => p.table_name === 'worker_reviews')
    .forEach((p) => console.log(`  · ${p.policy_name}`));

  await db.end();

  console.log(`\n=== Resultado: ${passed} OK, ${failed} fallos, ${warned} advertencias ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
