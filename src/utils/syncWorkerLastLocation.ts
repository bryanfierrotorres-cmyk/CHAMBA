/**
 * Sincroniza la última ubicación GPS del técnico en worker_profiles (best-effort).
 * No bloquea UI ni lanza si falla permiso / timeout.
 */
import { supabase } from '@services/supabase';
import { captureWorkerApplicantLocation } from '@utils/captureWorkerApplicantLocation';

const THROTTLE_MS = 5 * 60_000;
const lastSyncAtByWorker = new Map<string, number>();

export async function syncWorkerLastLocation(workerId: string): Promise<boolean> {
  if (!workerId) return false;

  const now = Date.now();
  const last = lastSyncAtByWorker.get(workerId) ?? 0;
  if (now - last < THROTTLE_MS) return false;

  const coords = await captureWorkerApplicantLocation();
  if (!coords) return false;

  const { data, error } = await supabase.rpc('update_worker_last_location', {
    p_worker_id: workerId,
    p_lat: coords.lat,
    p_lng: coords.lng,
  });

  if (error) {
    console.warn('[syncWorkerLastLocation] RPC:', error.message);
    return false;
  }

  const body = data as { success?: boolean; error?: string } | null;
  if (!body?.success) {
    if (body?.error) console.warn('[syncWorkerLastLocation]', body.error);
    return false;
  }

  lastSyncAtByWorker.set(workerId, now);
  return true;
}
