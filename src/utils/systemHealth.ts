/**
 * CHAMBA SYSTEM GUARD — Diagnóstico de salud del sistema.
 *
 * Punto único y reutilizable para saber con certeza el origen de un fallo:
 * internet, Supabase (API REST) o la base de datos (RPC).
 *
 * NO contiene lógica de negocio. Solo mide y reporta.
 */
import { ENV } from '@utils/env';
import { withTimeout, TimeoutError } from '@utils/withTimeout';

export type SupabaseHealth = 'ok' | 'slow' | 'down' | 'unknown';
export type RpcHealth = 'ok' | 'error' | 'timeout' | 'unknown';
export type SystemStatus = 'OK' | 'DEGRADED' | 'DOWN';

export interface SystemDiagnosis {
  internet: boolean;
  supabase: SupabaseHealth;
  rpc: RpcHealth;
  status: SystemStatus;
  reason: string;
  latencyMs: { supabase: number | null; rpc: number | null };
}

const REST_BASE = `${ENV.SUPABASE_URL}/rest/v1`;
const AUTH_HEADERS = {
  apikey: ENV.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
};

const INTERNET_PROBE_MS = 4_000;
const SUPABASE_PROBE_MS = 6_000;
const RPC_PROBE_MS = 6_000;
const SLOW_THRESHOLD_MS = 2_000;

/**
 * ¿Hay internet? Sondea un endpoint NEUTRAL (no Supabase) para poder
 * distinguir "internet caído" de "Supabase caído".
 */
export async function checkInternet(timeoutMs = INTERNET_PROBE_MS): Promise<boolean> {
  const probes = [
    'https://www.gstatic.com/generate_204',
    'https://cloudflare.com/cdn-cgi/trace',
  ];
  for (const url of probes) {
    try {
      // mode no-cors: en web la respuesta es opaca pero la promesa resuelve
      // si la red es alcanzable y rechaza si está offline.
      await withTimeout(fetch(url, { method: 'GET', mode: 'no-cors' as RequestMode }), timeoutMs);
      return true;
    } catch {
      // probar siguiente endpoint
    }
  }
  return false;
}

/**
 * Salud de la API REST de Supabase (PostgREST).
 * 200 rápido → ok | 200 lento → slow | 503/PGRST002 → down | timeout → down.
 */
export async function checkSupabaseHealth(
  timeoutMs = SUPABASE_PROBE_MS,
): Promise<{ health: SupabaseHealth; latencyMs: number | null; reason: string }> {
  const t0 = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${REST_BASE}/profiles?select=id&limit=1`, { headers: AUTH_HEADERS }),
      timeoutMs,
    );
    const latencyMs = Date.now() - t0;

    if (res.status === 200) {
      return latencyMs > SLOW_THRESHOLD_MS
        ? { health: 'slow', latencyMs, reason: `Respuesta lenta (${latencyMs}ms)` }
        : { health: 'ok', latencyMs, reason: 'OK' };
    }
    if (res.status === 503) {
      let code = '';
      try { code = ((await res.json()) as { code?: string })?.code ?? ''; } catch { /* sin body */ }
      return { health: 'down', latencyMs, reason: code ? `503 ${code}` : '503 Service Unavailable' };
    }
    return { health: 'down', latencyMs, reason: `HTTP ${res.status}` };
  } catch (err) {
    if (err instanceof TimeoutError) {
      return { health: 'down', latencyMs: null, reason: 'Timeout: Supabase saturado' };
    }
    return { health: 'down', latencyMs: null, reason: err instanceof Error ? err.message : 'Error de red' };
  }
}

/**
 * Salud del RPC de login.
 * 200 (con o sin fila) → ok | 503/timeout → timeout (saturado) | otro → error (DB/SQL).
 */
export async function checkRPCHealth(
  phone = '00000000',
  timeoutMs = RPC_PROBE_MS,
): Promise<{ health: RpcHealth; latencyMs: number | null; reason: string }> {
  const t0 = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${REST_BASE}/rpc/get_profile_by_phone`, {
        method: 'POST',
        headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_phone: phone }),
      }),
      timeoutMs,
    );
    const latencyMs = Date.now() - t0;

    if (res.status === 200) {
      // 200 con null = usuario inexistente, pero el RPC está SANO.
      return { health: 'ok', latencyMs, reason: 'OK' };
    }
    if (res.status === 503) {
      return { health: 'timeout', latencyMs, reason: '503: base de datos saturada' };
    }
    let msg = `HTTP ${res.status}`;
    try { msg = ((await res.json()) as { message?: string })?.message ?? msg; } catch { /* sin body */ }
    return { health: 'error', latencyMs, reason: msg };
  } catch (err) {
    if (err instanceof TimeoutError) {
      return { health: 'timeout', latencyMs: null, reason: 'RPC timeout' };
    }
    return { health: 'error', latencyMs: null, reason: err instanceof Error ? err.message : 'Error en RPC' };
  }
}

/**
 * Diagnóstico completo del sistema. Punto de entrada único.
 * Orden: internet → Supabase → RPC (cada capa solo si la anterior responde).
 */
export async function diagnoseSystem(phone?: string): Promise<SystemDiagnosis> {
  const internet = await checkInternet();
  if (!internet) {
    return {
      internet: false,
      supabase: 'unknown',
      rpc: 'unknown',
      status: 'DOWN',
      reason: 'Sin conexión a internet',
      latencyMs: { supabase: null, rpc: null },
    };
  }

  const sb = await checkSupabaseHealth();

  let rpc: { health: RpcHealth; latencyMs: number | null; reason: string } =
    { health: 'unknown', latencyMs: null, reason: 'no evaluado' };
  if (sb.health !== 'down') {
    rpc = await checkRPCHealth(phone);
  } else {
    rpc = { health: 'unknown', latencyMs: null, reason: 'Supabase caído' };
  }

  let status: SystemStatus = 'OK';
  let reason = 'Todo operativo';
  if (sb.health === 'down') {
    status = 'DOWN';
    reason = `Supabase no disponible (${sb.reason})`;
  } else if (rpc.health === 'error') {
    status = 'DEGRADED';
    reason = `RPC con error: ${rpc.reason}`;
  } else if (rpc.health === 'timeout' || sb.health === 'slow') {
    status = 'DEGRADED';
    reason = 'Servicio lento o saturado';
  }

  return {
    internet: true,
    supabase: sb.health,
    rpc: rpc.health,
    status,
    reason,
    latencyMs: { supabase: sb.latencyMs, rpc: rpc.latencyMs },
  };
}
