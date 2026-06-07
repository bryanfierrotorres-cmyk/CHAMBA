import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'CHAMBA_RADAR_DISMISSED_';
const MAX_ENTRIES = 150;
/** Las apartadas expiran — si la solicitud sigue abierta puede volver a aparecer. */
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

type DismissedEntry = {
  jobId: string;
  dismissedAt: number;
};

const storageKey = (workerId: string) => `${KEY_PREFIX}${workerId}`;

const pruneEntries = (entries: DismissedEntry[]): DismissedEntry[] => {
  const cutoff = Date.now() - TTL_MS;
  return entries
    .filter((e) => e.dismissedAt >= cutoff)
    .slice(-MAX_ENTRIES);
};

const readEntries = async (workerId: string): Promise<DismissedEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey(workerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DismissedEntry[];
    if (!Array.isArray(parsed)) return [];
    return pruneEntries(parsed);
  } catch {
    return [];
  }
};

export const loadRadarDismissedJobIds = async (workerId: string): Promise<Set<string>> => {
  const entries = await readEntries(workerId);
  const ids = new Set(entries.map((e) => e.jobId));
  if (entries.length > 0) {
    await AsyncStorage.setItem(storageKey(workerId), JSON.stringify(entries));
  }
  return ids;
};

export const dismissRadarJob = async (workerId: string, jobId: string): Promise<void> => {
  const entries = await readEntries(workerId);
  if (!entries.some((e) => e.jobId === jobId)) {
    entries.push({ jobId, dismissedAt: Date.now() });
  }
  await AsyncStorage.setItem(storageKey(workerId), JSON.stringify(pruneEntries(entries)));
};

export const restoreRadarJob = async (workerId: string, jobId: string): Promise<void> => {
  const entries = (await readEntries(workerId)).filter((e) => e.jobId !== jobId);
  await AsyncStorage.setItem(storageKey(workerId), JSON.stringify(entries));
};

export const clearRadarDismissedJobs = async (workerId: string): Promise<void> => {
  await AsyncStorage.removeItem(storageKey(workerId));
};
