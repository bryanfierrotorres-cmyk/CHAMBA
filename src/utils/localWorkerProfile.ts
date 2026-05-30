import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AvailabilityStatus, WorkerProfile } from '@/types';

const STORAGE_KEY = 'CHAMBA_WORKER_PROFILE_LOCAL';

type StoredMap = Record<string, Partial<WorkerProfile>>;

const readMap = async (): Promise<StoredMap> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeMap = async (map: StoredMap): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

const defaultProfile = (workerId: string): WorkerProfile => ({
  worker_id:           workerId,
  bio:                 null,
  skills:              [],
  id_verified:         false,
  id_document_url:     null,
  rating_avg:          null,
  total_reviews:       0,
  total_jobs_done:     0,
  availability_status: 'offline',
  updated_at:          new Date().toISOString(),
});

export const getLocalWorkerProfile = async (
  workerId: string,
): Promise<WorkerProfile | null> => {
  const map = await readMap();
  const entry = map[workerId];
  if (!entry) return null;
  return { ...defaultProfile(workerId), ...entry, worker_id: workerId };
};

export const patchLocalWorkerProfile = async (
  workerId: string,
  patch: Partial<WorkerProfile>,
): Promise<WorkerProfile> => {
  const map = await readMap();
  const prev = map[workerId] ?? {};
  const next: Partial<WorkerProfile> = {
    ...prev,
    ...patch,
    worker_id: workerId,
    updated_at: new Date().toISOString(),
  };
  map[workerId] = next;
  await writeMap(map);
  return { ...defaultProfile(workerId), ...next, worker_id: workerId };
};

export const setLocalAvailability = async (
  workerId: string,
  status: AvailabilityStatus,
): Promise<WorkerProfile> =>
  patchLocalWorkerProfile(workerId, { availability_status: status });
