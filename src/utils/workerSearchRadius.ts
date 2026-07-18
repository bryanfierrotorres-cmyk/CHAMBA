/**
 * Radio de búsqueda del técnico (km) — preferencia local, solo lectura del feed.
 * No afecta RPCs ni el matching server-side; es un filtro de presentación en el radar.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@chamba:worker_search_radius:';

export const RADIUS_OPTIONS_KM = [1, 3, 5, 8, 10, 15, 20, 30] as const;
export const DEFAULT_RADIUS_KM = 8;

export async function loadWorkerSearchRadiusKm(workerId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${workerId}`);
    const parsed = raw != null ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RADIUS_KM;
  } catch {
    return DEFAULT_RADIUS_KM;
  }
}

export async function saveWorkerSearchRadiusKm(workerId: string, km: number): Promise<void> {
  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${workerId}`, String(km));
  } catch {
    // best-effort; la preferencia simplemente no persiste esta sesión
  }
}
