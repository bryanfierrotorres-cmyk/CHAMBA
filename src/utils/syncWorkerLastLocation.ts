/**
 * Sincroniza la última ubicación GPS del técnico en worker_profiles (best-effort).
 * No bloquea UI ni lanza si falla permiso / timeout.
 */
import { supabase } from '@services/supabase';
import { captureWorkerApplicantLocation } from '@utils/captureWorkerApplicantLocation';
import { patchLocalWorkerProfile } from '@utils/localWorkerProfile';
import { useProfileStore } from '@store/profileStore';
import { ENV } from '@utils/env';

const IS_DEMO = ENV.DATA_MODE === 'demo';
const THROTTLE_MS = 5 * 60_000;
const lastSyncAtByWorker = new Map<string, number>();

/**
 * @param force  Ignora el throttle (usar cuando el técnico enciende el radar
 *               manualmente y necesitamos GPS sí o sí para permitirlo).
 */
export async function syncWorkerLastLocation(
  workerId: string,
  force = false,
): Promise<boolean> {
  if (!workerId) return false;

  const now = Date.now();
  const last = lastSyncAtByWorker.get(workerId) ?? 0;
  if (!force && now - last < THROTTLE_MS) return false;

  const coords = await captureWorkerApplicantLocation();
  if (!coords) return false;

  if (IS_DEMO) {
    await patchLocalWorkerProfile(workerId, {
      last_lat: coords.lat,
      last_lng: coords.lng,
      last_location_at: new Date().toISOString(),
    });
    lastSyncAtByWorker.set(workerId, now);
    void useProfileStore.getState().loadProfile(workerId);
    return true;
  }

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
  // Refresca el store para que el radar se centre en la ubicación recién captada.
  void useProfileStore.getState().loadProfile(workerId);
  return true;
}
