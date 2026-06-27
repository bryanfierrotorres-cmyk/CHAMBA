/**
 * CHAMBA SYSTEM GUARD — Protección de scripts de TEST / CHAOS / E2E.
 *
 * Impide que scripts de carga golpeen la base de datos de PRODUCCIÓN.
 * Importar y llamar `assertTestEnvironment('nombre')` justo después de cargar el .env.
 */

const PROD_URL_FRAGMENT = 'xvolxgonpjzjkytpsmil';

/**
 * Aborta si el script intenta correr contra producción sin autorización explícita.
 * @param {string} scriptName  nombre del script (para el mensaje de error)
 */
export function assertTestEnvironment(scriptName = 'script de test') {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const override = process.env.ALLOW_TEST_SCRIPTS === 'true';

  if (url.includes(PROD_URL_FRAGMENT) && !override) {
    throw new Error(
      `\n🚫 BLOQUEO CHAMBA SYSTEM GUARD\n` +
        `"${scriptName}" apunta a la BD de PRODUCCIÓN (${PROD_URL_FRAGMENT}).\n` +
        `Los scripts de test/caos NO pueden correr contra producción — saturan el free tier.\n\n` +
        `Soluciones:\n` +
        `  1. Creá un proyecto Supabase de TEST (gratis) y apuntá EXPO_PUBLIC_SUPABASE_URL ahí (.env.test).\n` +
        `  2. Si entendés el riesgo y querés forzarlo:\n` +
        `       ALLOW_TEST_SCRIPTS=true node scripts/${scriptName}.mjs\n`,
    );
  }

  if (process.env.NODE_ENV !== 'test' && !override) {
    throw new Error(
      `\n🚫 "${scriptName}" requiere entorno de test.\n` +
        `Ejecutá:  NODE_ENV=test node scripts/${scriptName}.mjs\n` +
        `(o ALLOW_TEST_SCRIPTS=true para forzar bajo tu responsabilidad)\n`,
    );
  }

  console.log(`✅ [SYSTEM GUARD] "${scriptName}" autorizado en entorno de test.`);
}

/**
 * Limitador de tasa para no saturar Supabase.
 * Devuelve una función `await throttle()` que espacia las llamadas.
 * @param {number} maxPerSec  máximo de operaciones por segundo (default 5)
 */
export function createRateLimiter(maxPerSec = 5) {
  const minGapMs = 1000 / Math.max(1, maxPerSec);
  let last = 0;
  return async function throttle() {
    const now = Date.now();
    const wait = Math.max(0, last + minGapMs - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
  };
}
