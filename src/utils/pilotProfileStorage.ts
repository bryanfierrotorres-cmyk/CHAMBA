import AsyncStorage from '@react-native-async-storage/async-storage';
import { repairLocalAssignmentsStorage } from '@utils/localAssignments';
import type { UserProfile } from '@/types';

export const PILOT_STORAGE_KEY = 'CHAMBA_PILOT_PROFILE';

const CATALOG_STORAGE_KEY = 'CHAMBA_SERVICE_CATALOG_V1';
const ASSIGNMENTS_STORAGE_KEY = 'CHAMBA_WORKER_ASSIGNMENTS';

const isQuotaError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('quota') || msg.includes('Quota') || msg.includes('exceeded');
};

/** No persistir data-URI (base64) — ocupan MB y rompen localStorage en web. */
const stripUrlForStorage = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return null;
  if (trimmed.length > 2048) return trimmed.slice(0, 2048);
  return trimmed;
};

/** Perfil mínimo para reabrir sesión por teléfono (sin blobs). */
export const compactProfileForStorage = (profile: UserProfile): UserProfile => ({
  ...profile,
  avatar_url: stripUrlForStorage(profile.avatar_url),
  cedula_url: stripUrlForStorage(profile.cedula_url),
  record_policia_url: stripUrlForStorage(profile.record_policia_url),
});

/** Libera espacio en localStorage (misma origin — datos de otros usuarios de prueba). */
export const freeChambaBrowserStorage = async (): Promise<void> => {
  await repairLocalAssignmentsStorage();
  try {
    await AsyncStorage.removeItem(CATALOG_STORAGE_KEY);
  } catch {
    // ignorar
  }
  try {
    await AsyncStorage.removeItem(ASSIGNMENTS_STORAGE_KEY);
  } catch {
    // ignorar
  }
};

/**
 * Guarda sesión piloto/teléfono. Si localStorage está lleno, libera cachés y reintenta.
 * Retorna false si solo queda en memoria (login sigue funcionando).
 */
export const safePersistPilotProfile = async (profile: UserProfile): Promise<boolean> => {
  const compact = compactProfileForStorage(profile);
  const payload = JSON.stringify(compact);

  const tryWrite = async (): Promise<void> => {
    await AsyncStorage.setItem(PILOT_STORAGE_KEY, payload);
  };

  try {
    await tryWrite();
    return true;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }

  console.warn('[safePersistPilotProfile] cuota llena — limpiando cachés CHAMBA…');
  await freeChambaBrowserStorage();

  try {
    await tryWrite();
    return true;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
    console.warn('[safePersistPilotProfile] sin espacio — sesión solo en memoria');
    return false;
  }
};

export const safeRemovePilotProfile = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PILOT_STORAGE_KEY);
  } catch {
    // ignorar
  }
};
