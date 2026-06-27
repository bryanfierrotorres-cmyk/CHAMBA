/**
 * CHAMBA SYSTEM GUARD — Keep-Alive (SOLO LECTURA).
 *
 * Evita que el free tier de Supabase se auto-pause (se pausa tras 7 días sin
 * actividad). Hace un ping de solo lectura. Pensado para correr en un cron
 * gratuito (GitHub Actions, ver .github/workflows/keep-alive.yml).
 *
 * Lee credenciales de env; si faltan, usa los valores públicos del proyecto
 * (la anon/publishable key ya es pública: vive en src/utils/env.ts y en el bundle).
 *
 * Ejecutar:  node scripts/production-safe/keep-alive.mjs
 */

const URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://xvolxgonpjzjkytpsmil.supabase.co';

const KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_uhhzt2htaTjd2BmCOJn80g__R-_shQZ';

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

(async () => {
  const stamp = new Date().toISOString();
  const t0 = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${URL}/rest/v1/profiles?select=id&limit=1`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      }),
      10_000,
    );
    const ms = Date.now() - t0;

    if (res.status === 200) {
      // Consumir el body para liberar el socket y permitir un cierre limpio.
      try { await res.text(); } catch { /* ignore */ }
      console.log(`✅ ${stamp} — Supabase activo (${ms}ms). Pausa evitada.`);
      process.exitCode = 0;
      return;
    }

    let code = '';
    try { code = (await res.json()).code || ''; } catch { /* sin body */ }
    console.error(`⚠️ ${stamp} — Supabase respondió HTTP ${res.status} ${code} (${ms}ms).`);
    process.exitCode = 1;
  } catch (e) {
    console.error(`❌ ${stamp} — Supabase no responde: ${e.message}`);
    process.exitCode = 1;
  }
})();
