/**
 * CHAMBA SYSTEM GUARD — Diagnóstico de salud (CLI, SOLO LECTURA).
 *
 * Seguro contra producción: solo hace lecturas (GET / RPC de login).
 * Espejo de src/utils/systemHealth.ts para usar desde la terminal.
 *
 * Ejecutar:  node scripts/production-safe/system-health.mjs
 */
import 'dotenv/config';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const SLOW_MS = 2000;

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function checkInternet() {
  for (const u of ['https://www.gstatic.com/generate_204', 'https://cloudflare.com/cdn-cgi/trace']) {
    try { await withTimeout(fetch(u), 4000); return true; } catch { /* siguiente */ }
  }
  return false;
}

async function checkSupabase() {
  const t0 = Date.now();
  try {
    const r = await withTimeout(fetch(`${URL}/rest/v1/profiles?select=id&limit=1`, { headers: H }), 6000);
    const ms = Date.now() - t0;
    if (r.status === 200) return { health: ms > SLOW_MS ? 'slow' : 'ok', ms, reason: 'OK' };
    if (r.status === 503) {
      let code = ''; try { code = (await r.json()).code || ''; } catch {}
      return { health: 'down', ms, reason: code || '503' };
    }
    return { health: 'down', ms, reason: `HTTP ${r.status}` };
  } catch (e) { return { health: 'down', ms: null, reason: e.message }; }
}

async function checkRpc(phone = '88884444') {
  const t0 = Date.now();
  try {
    const r = await withTimeout(fetch(`${URL}/rest/v1/rpc/get_profile_by_phone`, {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_phone: phone }),
    }), 6000);
    const ms = Date.now() - t0;
    if (r.status === 200) {
      const body = await r.json();
      return { health: 'ok', ms, reason: body?.full_name ? `OK (${body.full_name})` : 'OK (sin fila)' };
    }
    if (r.status === 503) return { health: 'timeout', ms, reason: '503 saturado' };
    let msg = `HTTP ${r.status}`; try { msg = (await r.json()).message || msg; } catch {}
    return { health: 'error', ms, reason: msg };
  } catch (e) { return { health: 'timeout', ms: null, reason: e.message }; }
}

(async () => {
  console.log('CHAMBA SYSTEM HEALTH —', URL, '\n');

  const internet = await checkInternet();
  console.log(`internet : ${internet ? '✅ OK' : '❌ SIN CONEXIÓN'}`);
  if (!internet) { console.log('\n=> STATUS: DOWN (sin internet)'); process.exitCode = 1; return; }

  const sb = await checkSupabase();
  console.log(`supabase : ${sb.health === 'ok' ? '✅' : sb.health === 'slow' ? '🟡' : '❌'} ${sb.health}  (${sb.ms ?? '—'}ms) ${sb.reason}`);

  const rpc = sb.health === 'down' ? { health: 'unknown', reason: 'Supabase caído' } : await checkRpc();
  console.log(`rpc      : ${rpc.health === 'ok' ? '✅' : '❌'} ${rpc.health}  (${rpc.ms ?? '—'}ms) ${rpc.reason}`);

  let status = 'OK';
  if (sb.health === 'down') status = 'DOWN';
  else if (rpc.health === 'error' || rpc.health === 'timeout' || sb.health === 'slow') status = 'DEGRADED';

  console.log(`\n=> STATUS: ${status}`);
  process.exitCode = status === 'DOWN' ? 1 : 0;
})();
