#!/usr/bin/env node
/** Repara especialidades de Papa para el radar. npm run db:fix-papa-radar */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAPA_ID = '43ce7eec-c77a-497a-a1d1-99e0946b83f8';

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

async function main() {
  const pg = await import('pg');
  const db = new pg.default.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  await db.query(
    `UPDATE profiles
        SET category_1 = 'electricista',
            category_1_approved = true,
            category_2 = 'limpieza_sofas',
            category_2_approved = true,
            worker_status = 'active',
            is_approved = true
      WHERE id = $1`,
    [PAPA_ID],
  );

  const { rows } = await db.query(
    `SELECT full_name, phone, category_1::text, category_2::text,
            category_1_approved, category_2_approved, worker_status, is_approved
       FROM profiles WHERE id = $1`,
    [PAPA_ID],
  );
  console.log('✅ Papa actualizado:', rows[0]);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
