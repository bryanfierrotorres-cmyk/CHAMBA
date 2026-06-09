import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '@constants/config';
import type { Job, JobAssignment, JobCategory, JobStatus, WorkerOperationalPhase } from '@/types';
import { preferOperationalPhase } from '@utils/workerOperationalPhase';

const STORAGE_KEY = 'CHAMBA_WORKER_ASSIGNMENTS';
const MAX_ENTRIES = 40;
const MAX_COMPLETED_KEEP = 15;

type StoredEntry = {
  assignment: Omit<JobAssignment, 'job'>;
  job: CompactJob | null;
};

/** Solo campos necesarios para Agenda — evita llenar localStorage. */
type CompactJob = {
  id: string;
  title: string;
  category: JobCategory;
  status: JobStatus;
  operational_phase?: WorkerOperationalPhase | null;
  pay_amount: number;
  worker_payout: number;
  duration_hours?: number;
  address?: string;
  updated_at?: string;
  created_by?: string;
};

let memoryCache: StoredEntry[] | null = null;

const compactJob = (job: Job | Partial<Job> | null | undefined): CompactJob | null => {
  if (!job?.id) return null;
  return {
    id: job.id,
    title: job.title ?? 'Chamba',
    category: (job.category ?? 'limpieza_sofas') as JobCategory,
    status: (job.status ?? 'in_progress') as JobStatus,
    operational_phase: job.operational_phase ?? null,
    pay_amount: job.pay_amount ?? 0,
    worker_payout: job.worker_payout ?? 0,
    duration_hours: job.duration_hours,
    address: job.location?.address ?? (job as Job & { address?: string }).address,
    updated_at: job.updated_at,
    created_by: job.created_by,
  };
};

const expandJob = (c: CompactJob | null): Job | undefined => {
  if (!c) return undefined;
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    status: c.status,
    operational_phase: c.operational_phase ?? undefined,
    pay_amount: c.pay_amount,
    worker_payout: c.worker_payout,
    duration_hours: c.duration_hours ?? 0,
    platform_fee: 0,
    description: '',
    location: { address: c.address ?? '', lat: 0, lng: 0 },
    scheduled_at: null,
    scheduled_date: null,
    scheduled_time: null,
    urgency_level: 'hoy',
    required_workers: 1,
    slots_taken: 1,
    media_urls: [],
    created_by: c.created_by ?? '',
    created_at: c.updated_at ?? new Date().toISOString(),
    updated_at: c.updated_at ?? new Date().toISOString(),
  } as Job;
};

const toAssignment = (entry: StoredEntry): JobAssignment => ({
  ...entry.assignment,
  job: expandJob(entry.job),
});

const pruneEntries = (entries: StoredEntry[]): StoredEntry[] => {
  if (entries.length <= MAX_ENTRIES) return entries;

  const active = entries.filter(
    (e) => e.job?.status !== 'completed' && e.job?.status !== 'cancelled',
  );
  const completed = entries
    .filter((e) => e.job?.status === 'completed' || e.job?.status === 'cancelled')
    .slice(0, MAX_COMPLETED_KEEP);

  return [...active, ...completed].slice(0, MAX_ENTRIES);
};

const serializeEntry = (
  assignment: JobAssignment,
  job: Job | Partial<Job> | null,
): StoredEntry => {
  const { job: _nested, ...assignmentCore } = assignment;
  const compact = compactJob(job ?? assignment.job ?? null);
  return {
    assignment: assignmentCore,
    job: compact,
  };
};

const readAll = async (): Promise<StoredEntry[]> => {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryCache = [];
      return memoryCache;
    }
    const parsed = JSON.parse(raw) as StoredEntry[];
    memoryCache = Array.isArray(parsed) ? parsed : [];
    return memoryCache;
  } catch {
    memoryCache = [];
    return memoryCache;
  }
};

const writeAll = async (entries: StoredEntry[]): Promise<void> => {
  const pruned = pruneEntries(entries);
  memoryCache = pruned;

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('quota') && !msg.includes('Quota')) {
      console.warn('[localAssignments] write failed:', msg);
      return;
    }
  }

  // Cuota llena: conservar solo activas + últimas completadas
  const slim = pruneEntries(
    pruned.filter((e) => e.job?.status !== 'completed').concat(
      pruned.filter((e) => e.job?.status === 'completed').slice(0, 5),
    ),
  );
  memoryCache = slim;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch {
    memoryCache = slim.slice(0, 10);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
    } catch {
      // Memoria sigue funcionando aunque no persista
      console.warn('[localAssignments] storage quota — usando solo caché en memoria');
    }
  }
};

/** Limpia almacenamiento inflado (ejecutar una vez si hubo error de cuota). */
export const repairLocalAssignmentsStorage = async (): Promise<void> => {
  memoryCache = null;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorar
  }
  memoryCache = [];
};

export const getAllLocalAssignments = async (): Promise<JobAssignment[]> =>
  (await readAll()).map(toAssignment);

export const getLocalAssignments = async (workerId: string): Promise<JobAssignment[]> => {
  const entries = await readAll();
  let filtered = entries.filter((e) => e.assignment.worker_id === workerId);

  if (filtered.length === 0 && CONFIG.pilot.enabled && entries.length > 0) {
    filtered = entries;
  }

  return filtered.map(toAssignment);
};

export const upsertLocalAssignment = async (
  assignment: JobAssignment,
  job: Job | Partial<Job> | null,
): Promise<void> => {
  try {
    const entries = await readAll();
    const idx = entries.findIndex(
      (e) =>
        e.assignment.id === assignment.id ||
        e.assignment.job_id === assignment.job_id,
    );
    const entry = serializeEntry(assignment, job);
    if (idx === -1) entries.unshift(entry);
    else entries[idx] = entry;
    await writeAll(entries);
  } catch (err) {
    console.warn('[upsertLocalAssignment]', err instanceof Error ? err.message : err);
  }
};

export const patchLocalJobStatus = async (
  jobId: string,
  status: JobStatus,
  completedAt?: string,
  operationalPhase?: WorkerOperationalPhase | null,
): Promise<void> => {
  try {
    const entries = await readAll();
    let changed = false;
    const next = entries.map((e) => {
      if (e.assignment.job_id !== jobId && e.job?.id !== jobId) return e;
      changed = true;
      const job = e.job
        ? {
            ...e.job,
            status,
            ...(operationalPhase !== undefined
              ? { operational_phase: operationalPhase }
              : {}),
            updated_at: new Date().toISOString(),
          }
        : null;
      const assignment = {
        ...e.assignment,
        ...(completedAt ? { completed_at: completedAt } : {}),
      };
      return { assignment, job };
    });
    if (changed) await writeAll(next);
  } catch (err) {
    console.warn('[patchLocalJobStatus]', err instanceof Error ? err.message : err);
  }
};

/** Actualiza caché en memoria sin escribir AsyncStorage (instantáneo). */
export const patchLocalOperationalPhase = async (
  jobId: string,
  phase: WorkerOperationalPhase,
  status: JobStatus,
): Promise<void> => {
  await patchLocalJobStatus(jobId, status, undefined, phase);
};

export const patchLocalJobStatusMemory = (
  jobId: string,
  status: JobStatus,
  completedAt?: string,
  operationalPhase?: WorkerOperationalPhase | null,
): void => {
  if (!memoryCache) return;
  memoryCache = memoryCache.map((e) => {
    if (e.assignment.job_id !== jobId && e.job?.id !== jobId) return e;
    const job = e.job
      ? {
          ...e.job,
          status,
          ...(operationalPhase !== undefined
            ? { operational_phase: operationalPhase }
            : {}),
          updated_at: new Date().toISOString(),
        }
      : null;
    return {
      assignment: {
        ...e.assignment,
        ...(completedAt ? { completed_at: completedAt } : {}),
      },
      job,
    };
  });
};

const mergeJob = (
  a?: Job | Partial<Job>,
  b?: Job | Partial<Job>,
): Job | undefined => {
  if (!a && !b) return undefined;
  if (!a) return b as Job;
  if (!b) return a as Job;
  const status = preferStatus(
    (a.status ?? 'open') as JobStatus,
    (b.status ?? 'open') as JobStatus,
  );
  const operational_phase = preferOperationalPhase(
    a.operational_phase ?? null,
    b.operational_phase ?? null,
  );
  return {
    ...a,
    ...b,
    status,
    ...(operational_phase ? { operational_phase } : {}),
  } as Job;
};

export const mergeAssignments = (
  remote: JobAssignment[],
  local: JobAssignment[],
): JobAssignment[] => {
  const byJobId = new Map<string, JobAssignment>();

  const ingest = (a: JobAssignment) => {
    const prev = byJobId.get(a.job_id);
    if (!prev) {
      byJobId.set(a.job_id, a);
      return;
    }
    byJobId.set(a.job_id, {
      ...prev,
      ...a,
      job: mergeJob(prev.job, a.job),
    });
  };

  for (const a of local) ingest(a);
  for (const a of remote) ingest(a);

  return Array.from(byJobId.values()).sort(
    (x, y) => new Date(y.assigned_at).getTime() - new Date(x.assigned_at).getTime(),
  );
};

export const migrateLocalAssignmentsWorkerId = async (
  oldWorkerId: string,
  newWorkerId: string,
): Promise<void> => {
  if (oldWorkerId === newWorkerId) return;
  const entries = await readAll();
  let changed = false;
  const next = entries.map((e) => {
    if (e.assignment.worker_id !== oldWorkerId) return e;
    changed = true;
    const jobId = e.assignment.job_id;
    const legacyId = `${jobId}-${oldWorkerId}`;
    const nextId = e.assignment.id === legacyId
      ? `${jobId}-${newWorkerId}`
      : e.assignment.id;
    return {
      assignment: { ...e.assignment, id: nextId, worker_id: newWorkerId },
      job: e.job,
    };
  });
  if (changed) await writeAll(next);
};

const STATUS_RANK: Record<JobStatus, number> = {
  open: 0,
  taken: 1,
  in_progress: 2,
  completed: 3,
  cancelled: 3,
};

function preferStatus(a: JobStatus, b: JobStatus): JobStatus {
  const aTerminal = a === 'completed' || a === 'cancelled';
  const bTerminal = b === 'completed' || b === 'cancelled';
  if (aTerminal && !bTerminal) return b;
  if (bTerminal && !aTerminal) return a;
  return STATUS_RANK[b] >= STATUS_RANK[a] ? b : a;
}
