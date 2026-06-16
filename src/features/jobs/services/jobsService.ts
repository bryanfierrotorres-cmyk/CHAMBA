import { supabase } from '@services/supabase';
import type {
  Job,
  JobAssignment,
  JobCategory,
  JobStatus,
  PaginatedResponse,
  ClientOrderJob,
  ClientJobSummary,
  AssignedWorkerSummary,
  WorkerOperationalPhase,
  WorkerReview,
} from '@/types';
import { fetchWorkerReviews, fetchWorkerRatingSummary } from '@features/reviews/services/reviewsService';
import {
  getClientPhaseMessage,
  phaseToJobStatus,
} from '@utils/workerOperationalPhase';
import { validateClientPrice } from '@constants/servicePricing';
import { resolveOfferSuggestedPriceFromDb } from '@utils/offerSuggestedPrice';
import { fetchPreciosCatalogo, mapPreciosRowsToMap } from '@features/catalog/services/preciosCatalogService';
import { captureWorkerApplicantLocation } from '@utils/captureWorkerApplicantLocation';
import { SELECTION_STATUS } from '@constants/jobWorkflowStatus';
import { fromDbJobCategory, toDbJobCategory, toDbJobCategoryQueryValues } from '@constants/chambaCategories';
import {
  getLocalAssignments,
  upsertLocalAssignment,
  mergeRemoteWithOptimisticLocal,
  pruneOrphanLocalAssignments,
  patchLocalJobStatus,
  patchLocalOperationalPhase,
} from '@utils/localAssignments';
import {
  getJobRadarMinCreatedAtIso,
  isJobExpiredLocally,
} from '@constants/jobExpiry';
import { workerCoversJobCategory } from '@utils/workerCategoryAccess';
import {
  ensureProfileInDb,
  resolveWorkerProfileForActions,
  syncProfileWithDatabase,
  normalizePhone,
} from '@utils/profileSync';
import {
  normalizeWorkerAssignmentRow,
  normalizeWorkerAssignmentRows,
} from '@utils/normalizeWorkerAssignment';
import type { UserProfile } from '@/types';
import { withTimeout } from '@utils/withTimeout';
import { useAuthStore } from '@store/authStore';
import { assertClientJobPlatformReady } from '@services/clientJobPlatform';
import { resolveJobScheduling } from '@utils/jobScheduling';
import type { UrgencyLevel } from '@/types';
import {
  MAX_CLIENT_ACTIVE_JOBS,
  MAX_WORKER_ACTIVE_COMMITMENTS,
  CLIENT_ACTIVE_JOBS_LIMIT_MESSAGE,
  WORKER_ACTIVE_COMMITMENTS_LIMIT_MESSAGE,
} from '@constants/jobLimits';

type ClientProfileRef = Pick<
  UserProfile,
  'id' | 'full_name' | 'phone' | 'email' | 'role' | 'is_approved'
>;

/** ID canónico del cliente (perfil en BD por teléfono) antes de crear/listar. */
export const resolveClientIdForJobs = async (profile: ClientProfileRef): Promise<string> => {
  const synced = await syncProfileWithDatabase(profile as UserProfile);

  const targetId = synced.id;
  const phone = normalizePhone(synced.phone);

  const { error } = await supabase.from('profiles').upsert(
    {
      id:          targetId,
      full_name:   synced.full_name.trim(),
      phone:       phone || null,
      email:       synced.email ?? '',
      role:        'client',
      is_approved: synced.is_approved ?? true,
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.warn('[resolveClientIdForJobs] profile upsert:', error.message);
  }

  return targetId;
};

const parseRpcJobPayload = (raw: unknown): Job | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Job;
    } catch {
      return null;
    }
  }
  return raw as Job;
};

const parseCreateJobRpc = (
  data: unknown,
): { success: boolean; job?: Job; error?: string } | null => {
  if (!data || typeof data !== 'object') return null;
  const body = data as { success?: boolean; job?: unknown; error?: string };
  const job = parseRpcJobPayload(body.job);
  return {
    success: !!body.success,
    job: job ?? undefined,
    error: body.error,
  };
};

type AcceptWorkerContext = Pick<
  UserProfile,
  'id' | 'full_name' | 'phone' | 'email' | 'role' | 'is_approved'
>;

const PAGE_SIZE = 20;

/** Excluye solicitudes open vencidas (>60 min) — refuerzo local si el RPC aún no filtra. */
const filterActiveOpenJobs = (jobs: Job[], status?: JobStatus): Job[] => {
  if (status !== 'open') return jobs;
  return jobs.filter((j) => !isJobExpiredLocally(j.created_at));
};

const unwrapAssignedWorker = (
  raw: AssignedWorkerSummary | AssignedWorkerSummary[] | null | undefined,
): AssignedWorkerSummary | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
};

const normalizeJobRow = (row: Job & { address?: string; lat?: number; lng?: number }): Job => {
  const raw = row as Job & { address?: string; lat?: number; lng?: number };
  const address = raw.location?.address ?? raw.address ?? '';
  const lat = raw.location?.lat ?? raw.lat ?? 0;
  const lng = raw.location?.lng ?? raw.lng ?? 0;

  const creator = raw.creator && typeof raw.creator === 'object'
    ? {
        id: raw.creator.id,
        full_name: raw.creator.full_name,
        avatar_url: raw.creator.avatar_url ?? null,
      }
    : raw.creator;

  return {
    ...row,
    status: (row.status ?? 'open') as JobStatus,
    category: (fromDbJobCategory(row.category as string) ?? row.category) as JobCategory,
    media_urls: Array.isArray(row.media_urls) ? row.media_urls : [],
    creator,
    location: {
      address,
      lat,
      lng,
      distance_km: raw.location?.distance_km,
    },
  };
};

const parseRpcAssignmentRows = (data: unknown): JobAssignment[] => {
  if (Array.isArray(data)) return data as JobAssignment[];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? (parsed as JobAssignment[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** Fallback cuando RLS bloquea SELECT directo en job_assignments. */
const fetchAssignmentsViaRpc = async (workerId: string): Promise<JobAssignment[]> => {
  const rpcNames = ['get_worker_agenda_panel', 'get_worker_assignments'] as const;

  for (const rpcName of rpcNames) {
    const { data, error } = await supabase.rpc(rpcName, {
      p_worker_id: workerId,
    });

    if (error) {
      console.warn(`[fetchWorkerAssignments] RPC ${rpcName}:`, error.message);
      continue;
    }

    const rows = parseRpcAssignmentRows(data);
    if (rows.length > 0) {
      return normalizeWorkerAssignmentRows(rows.map((row) => ({
        ...row,
        job: row.job ? normalizeJobRow(row.job as Job) : row.job,
      })));
    }
  }

  return [];
};

/** Fallback cuando RLS bloquea SELECT directo en job_assignments. */
const fetchAssignmentsViaJobs = async (workerId: string): Promise<JobAssignment[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      assignments:job_assignments!inner(
        id, job_id, worker_id, assigned_at, completed_at, payment_status, payment_intent_id
      )
    `)
    .eq('assignments.worker_id', workerId)
    .order('created_at', { ascending: false });

  if (error || !data?.length) return [];

  return data.flatMap((row: Job & { assignments?: JobAssignment[] }) => {
    const match = row.assignments?.find((a) => a.worker_id === workerId);
    if (!match) return [];
    const { assignments: _a, ...jobFields } = row;
    return [{
      ...match,
      job: normalizeJobRow(jobFields as Job),
    }];
  });
};

/**
 * Piloto: leer asignaciones desde jobs.assigned_worker_id (tras migración 006).
 */
const fetchAssignmentsViaWorkerColumn = async (
  workerId: string,
): Promise<JobAssignment[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('assigned_worker_id', workerId)
    .order('created_at', { ascending: false });

  if (error || !data?.length) return [];

  return (data as Job[]).map((raw) => {
    const job = normalizeJobRow(raw);
    const selectionStatus =
      job.status === 'taken' || job.status === 'in_progress'
        ? SELECTION_STATUS.APPROVED
        : SELECTION_STATUS.PENDING;
    return {
      id: `${job.id}-${workerId}`,
      job_id: job.id,
      worker_id: workerId,
      assigned_at: job.updated_at ?? job.created_at,
      completed_at: job.status === 'completed' ? (job.updated_at ?? null) : null,
      payment_status: 'pending' as const,
      payment_intent_id: null,
      selection_status: selectionStatus,
      job,
    };
  });
};

interface FetchJobsParams {
  status?: JobStatus;
  category?: JobCategory;
  /** Filter by multiple categories at once (OR). Overrides `category` if both provided. */
  categories?: JobCategory[];
  page?: number;
  /** Login nombre+teléfono: feed vía RPC sin JWT (auth.uid). */
  workerId?: string;
}

const categoriesToDbFilter = (categories?: JobCategory[]): string[] | null =>
  categories && categories.length > 0
    ? Array.from(new Set(categories.flatMap((c) => toDbJobCategoryQueryValues(c))))
    : null;

const fetchJobsViaWorkerRpc = async ({
  workerId,
  status = 'open',
  categories,
  page = 0,
}: FetchJobsParams & { workerId: string }): Promise<PaginatedResponse<Job> | null> => {
  const dbCategories = categoriesToDbFilter(categories);

  const { data, error } = await supabase.rpc('get_worker_open_jobs_feed', {
    p_worker_id: workerId,
    p_status: status,
    p_categories: dbCategories,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });

  if (error) {
    console.warn('[fetchJobs] RPC get_worker_open_jobs_feed:', error.message);
    return null;
  }

  const body = data as { success?: boolean; jobs?: Job[]; count?: number; error?: string } | null;
  if (!body?.success) {
    if (body?.error) console.warn('[fetchJobs] worker RPC:', body.error);
    return null;
  }

  const rows = (body.jobs ?? []) as Job[];
  const total = body.count ?? rows.length;
  const freshRows = filterActiveOpenJobs(rows.map(normalizeJobRow), status);

  return {
    data: freshRows,
    count: total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: total > (page + 1) * PAGE_SIZE,
  };
};

const fetchJobsViaRpc = async ({
  status = 'open',
  categories,
  page = 0,
}: FetchJobsParams): Promise<PaginatedResponse<Job> | null> => {
  const dbCategories = categoriesToDbFilter(categories);

  const { data, error } = await supabase.rpc('get_open_jobs_feed', {
    p_status: status,
    p_categories: dbCategories,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });

  if (error) {
    console.warn('[fetchJobs] RPC get_open_jobs_feed:', error.message);
    return null;
  }

  const body = data as { success?: boolean; jobs?: Job[]; count?: number; error?: string } | null;
  if (!body?.success) {
    if (body?.error) console.warn('[fetchJobs] RPC:', body.error);
    return null;
  }

  const rows = (body.jobs ?? []) as Job[];
  const total = body.count ?? rows.length;
  const freshRows = filterActiveOpenJobs(rows.map(normalizeJobRow), status);

  return {
    data: freshRows,
    count: total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: total > (page + 1) * PAGE_SIZE,
  };
};

/** Fetch paginated jobs. */
export const fetchJobs = async ({
  status = 'open',
  category,
  categories,
  page = 0,
  workerId,
}: FetchJobsParams = {}): Promise<PaginatedResponse<Job>> => {
  if (categories !== undefined && categories.length === 0) {
    return {
      data: [],
      count: 0,
      page,
      pageSize: PAGE_SIZE,
      hasMore: false,
    };
  }

  // Regla: feed del técnico SIEMPRE por worker_id (no depender de JWT / RLS).
  if (workerId) {
    const workerFeed = await fetchJobsViaWorkerRpc({
      workerId,
      status,
      category,
      categories,
      page,
    });
    if (workerFeed) return workerFeed;
  }

  let query = supabase
    .from('jobs')
    .select(
      `*, creator:profiles!created_by(id, full_name, avatar_url)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (status) query = query.eq('status', status);
  if (status === 'open') {
    query = query.gte('created_at', getJobRadarMinCreatedAtIso());
  }

  // Multi-category filter takes priority; single category is a fallback
  if (categories && categories.length > 0) {
    const dbValues = Array.from(
      new Set(categories.flatMap((c) => toDbJobCategoryQueryValues(c))),
    );
    query = query.in('category', dbValues);
  } else if (category) {
    const dbValues = toDbJobCategoryQueryValues(category);
    query = dbValues.length > 1 ? query.in('category', dbValues) : query.eq('category', dbValues[0]);
  }

  const { data, error, count } = await query;

  if (error) {
    if (workerId) {
      const workerFeed = await fetchJobsViaWorkerRpc({
        workerId,
        status,
        category,
        categories,
        page,
      });
      if (workerFeed) return workerFeed;
    }
    const rpcFallback = await fetchJobsViaRpc({ status, category, categories, page });
    if (rpcFallback) return rpcFallback;
    throw new Error(error.message);
  }

  const normalized = filterActiveOpenJobs(
    ((data ?? []) as Job[]).map(normalizeJobRow),
    status,
  );

  if (normalized.length === 0 && page === 0) {
    if (workerId) {
      const workerFeed = await fetchJobsViaWorkerRpc({
        workerId,
        status,
        category,
        categories,
        page,
      });
      if (workerFeed && workerFeed.data.length > 0) return workerFeed;
    }
    const rpcFallback = await fetchJobsViaRpc({ status, category, categories, page });
    if (rpcFallback && rpcFallback.data.length > 0) return rpcFallback;
  }

  return {
    data: normalized,
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    hasMore: (count ?? 0) > (page + 1) * PAGE_SIZE,
  };
};

/** Fetch a single job by ID. */
export const fetchJobById = async (jobId: string): Promise<Job> => {
  const { data, error } = await supabase
    .from('jobs')
    .select(`*, creator:profiles!created_by(id, full_name, avatar_url, phone)`)
    .eq('id', jobId)
    .single();

  if (error) throw new Error(error.message);
  return normalizeJobRow(data as Job);
};

/** Fetch all assignments for a worker (remoto + caché local piloto). */
export const fetchWorkerAssignments = async (
  workerId: string,
  profile?: UserProfile | null,
): Promise<JobAssignment[]> => {
  let effectiveWorkerId = workerId;

  if (profile?.id) {
    try {
      const synced = await syncProfileWithDatabase(profile);
      effectiveWorkerId = synced.id;
    } catch (err) {
      console.warn('[fetchWorkerAssignments] auth/sync:', err);
    }
  }

  let remote: JobAssignment[] = [];

  try {
    const viaRpc = await fetchAssignmentsViaRpc(effectiveWorkerId);
    if (viaRpc.length > 0) {
      remote = viaRpc;
    } else {
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`*, job:jobs(*)`)
        .eq('worker_id', effectiveWorkerId)
        .order('assigned_at', { ascending: false })
        .limit(50);

      if (!error && (data ?? []).length > 0) {
        remote = (data ?? []) as JobAssignment[];
      }
    }

    remote = remote.map((a) => normalizeWorkerAssignmentRow({
      ...a,
      job: a.job ? normalizeJobRow(a.job as Job) : a.job,
    }));
  } catch (err) {
    console.warn('[fetchWorkerAssignments]', err);
  }

  const local = await getLocalAssignments(effectiveWorkerId);
  if (remote.length > 0) {
    await pruneOrphanLocalAssignments(effectiveWorkerId, remote);
  }
  const merged = mergeRemoteWithOptimisticLocal(remote, local);
  return merged.length > 0 ? merged : local;
};

const coerceRpcCount = (data: unknown): number | null => {
  if (typeof data === 'number' && Number.isFinite(data)) return data;
  const n = Number(data);
  return Number.isFinite(n) ? n : null;
};

const assertClientCanPublish = async (clientId: string): Promise<void> => {
  const { data, error } = await supabase.rpc('count_client_active_jobs', {
    p_client_id: clientId,
  });
  const count = coerceRpcCount(data);
  if (!error && count !== null && count >= MAX_CLIENT_ACTIVE_JOBS) {
    throw new Error(CLIENT_ACTIVE_JOBS_LIMIT_MESSAGE);
  }
};

const assertWorkerCanPostulate = async (workerId: string): Promise<void> => {
  const { data, error } = await supabase.rpc('count_worker_active_commitments', {
    p_worker_id: workerId,
  });
  const count = coerceRpcCount(data);
  if (!error && count !== null && count >= MAX_WORKER_ACTIVE_COMMITMENTS) {
    throw new Error(WORKER_ACTIVE_COMMITMENTS_LIMIT_MESSAGE);
  }
};

const tryRpcAccept = async (
  jobId: string,
  workerId: string,
  applicantCoords?: { lat: number; lng: number } | null,
): Promise<{
  ok: boolean;
  assignmentId?: string;
  error?: string;
  selectionStatus?: string;
}> => {
  const rpcParams: {
    p_job_id: string;
    p_worker_id: string;
    p_applicant_lat?: number;
    p_applicant_lng?: number;
  } = {
    p_job_id: jobId,
    p_worker_id: workerId,
  };
  if (applicantCoords) {
    rpcParams.p_applicant_lat = applicantCoords.lat;
    rpcParams.p_applicant_lng = applicantCoords.lng;
  }

  const { data, error } = await supabase.rpc('accept_job', rpcParams);

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as {
    success?: boolean;
    error?: string;
    assignment_id?: string;
    selection_status?: string;
  } | null;
  if (!result?.success) {
    return { ok: false, error: result?.error ?? 'No se pudo postular al trabajo' };
  }

  return {
    ok: true,
    assignmentId: result.assignment_id,
    selectionStatus: result.selection_status,
  };
};

/** Confirma en BD que la postulación existe (evita éxito falso solo en caché local). */
const fetchRemoteAssignmentForJob = async (
  jobId: string,
  workerId: string,
): Promise<JobAssignment | null> => {
  const { data, error } = await supabase
    .from('job_assignments')
    .select('*')
    .eq('job_id', jobId)
    .eq('worker_id', workerId)
    .maybeSingle();

  if (error || !data) return null;
  return data as JobAssignment;
};

const buildAssignment = (
  jobId: string,
  workerId: string,
  assignmentId: string | undefined,
  job: Job | null,
  selectionStatus: 'pending' | 'approved' = 'approved',
): JobAssignment => {
  const now = new Date().toISOString();
  const pendingClient = selectionStatus === 'pending';
  return {
    id: assignmentId ?? `${jobId}-${workerId}`,
    job_id: jobId,
    worker_id: workerId,
    assigned_at: now,
    completed_at: null,
    payment_status: 'pending',
    payment_intent_id: null,
    selection_status: selectionStatus,
    job: job
      ? {
          ...normalizeJobRow(job),
          status: (pendingClient ? 'open' : 'taken') as JobStatus,
          operational_phase: pendingClient
            ? null
            : ('accepted' as WorkerOperationalPhase),
          updated_at: now,
        }
      : undefined,
  };
};

const acceptJobPilotFallback = async (
  jobId: string,
  workerId: string,
): Promise<{ assignmentId?: string; selectionStatus: 'pending' | 'approved' }> => {
  await assertWorkerCanPostulate(workerId);
  const assignmentId = `${jobId}-${workerId}`;

  const { error: insertErr } = await supabase.from('job_assignments').insert({
    job_id: jobId,
    worker_id: workerId,
    selection_status: 'pending',
  });

  if (insertErr) {
    throw new Error(insertErr.message);
  }

  return { assignmentId, selectionStatus: 'pending' };
};

/** Notifica al cliente sobre avance operativo (viaje / llegada). */
const notifyClientOperationalUpdate = async (
  job: Pick<Job, 'id' | 'created_by' | 'title'>,
  phase: WorkerOperationalPhase,
): Promise<void> => {
  const clientId = job.created_by;
  if (!clientId) return;

  const { title, body } = getClientPhaseMessage(phase);
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        user_ids: [clientId],
        title,
        body,
        type: 'job_update',
        data: { job_id: job.id, phase, job_title: job.title ?? '' },
      },
    });
  } catch (err) {
    console.warn('[notifyClientOperationalUpdate]', err);
  }
};

/** Avanza la fase operativa del técnico y notifica al cliente. */
export const advanceOperationalPhase = async (
  jobId: string,
  workerId: string,
  nextPhase: WorkerOperationalPhase,
  jobSnapshot?: Job | null,
  workerCtx?: UserProfile | null,
): Promise<void> => {
  let effectiveWorkerId = workerId;
  if (workerCtx) {
    const resolved = await resolveWorkerProfileForActions(workerCtx);
    effectiveWorkerId = resolved.id;
  }

  const status = phaseToJobStatus(nextPhase);

  await patchLocalOperationalPhase(jobId, nextPhase, status);

  let job = jobSnapshot ?? null;
  if (!job) {
    try {
      job = await fetchJobById(jobId);
    } catch {
      job = null;
    }
  }

  const { data, error } = await supabase.rpc('worker_advance_operational_phase', {
    p_job_id: jobId,
    p_worker_id: effectiveWorkerId,
    p_phase: nextPhase,
  });

  const body = data as { success?: boolean; error?: string } | null;
  if (error) {
    throw new Error(error.message);
  }
  if (!body?.success) {
    throw new Error(body?.error ?? 'No se pudo actualizar el estado del servicio');
  }

  if (
    job
    && (nextPhase === 'en_route' || nextPhase === 'arrived' || nextPhase === 'completed')
  ) {
    void notifyClientOperationalUpdate(job, nextPhase);
  }
};

/** Worker: Mark a job as in_progress (En proceso). */
export const startJob = async (jobId: string, workerId?: string): Promise<void> => {
  if (workerId) {
    const { data, error } = await supabase.rpc('worker_start_job', {
      p_job_id: jobId,
      p_worker_id: workerId,
    });
    if (!error && (data as { success?: boolean })?.success) {
      await patchLocalJobStatus(jobId, 'in_progress');
      return;
    }
  }

  const { error } = await supabase
    .from('jobs')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    await patchLocalJobStatus(jobId, 'in_progress');
    if (workerId) return;
    throw new Error(error.message);
  }
  await patchLocalJobStatus(jobId, 'in_progress');
};

/** Worker: Mark a job as completed (Finalizado). Fuente de verdad en BD — el cliente ve el mismo status. */
export const completeJob = async (
  jobId: string,
  assignmentId: string,
  workerId?: string,
  jobSnapshot?: Job | Partial<Job> | null,
  workerCtx?: UserProfile | null,
): Promise<void> => {
  let effectiveWorkerId = workerId;
  if (workerCtx) {
    const resolved = await resolveWorkerProfileForActions(workerCtx);
    effectiveWorkerId = resolved.id;
  }

  const now = new Date().toISOString();
  let job = jobSnapshot ?? null;

  const finishLocally = async (): Promise<void> => {
    await patchLocalJobStatus(jobId, 'completed', now, 'completed');
    if (!job) {
      try {
        job = await fetchJobById(jobId);
      } catch {
        job = null;
      }
    }
    if (job?.created_by && job.id) {
      void notifyClientOperationalUpdate(
        { id: job.id, created_by: job.created_by, title: job.title ?? '' },
        'completed',
      );
    }
  };

  if (effectiveWorkerId) {
    const { data, error } = await supabase.rpc('worker_complete_job', {
      p_job_id: jobId,
      p_worker_id: effectiveWorkerId,
      p_assignment_id: assignmentId,
    });
    const body = data as { success?: boolean; error?: string } | null;
    if (!error && body?.success) {
      await finishLocally();
      return;
    }

    const { data: advData, error: advErr } = await supabase.rpc(
      'worker_advance_operational_phase',
      {
        p_job_id: jobId,
        p_worker_id: effectiveWorkerId,
        p_phase: 'completed',
      },
    );
    const advBody = advData as { success?: boolean; error?: string } | null;
    if (!advErr && advBody?.success) {
      await finishLocally();
      return;
    }

    const rpcMsg =
      error?.message
      ?? body?.error
      ?? advErr?.message
      ?? advBody?.error;
    if (rpcMsg) {
      throw new Error(rpcMsg);
    }
  }

  const [jobErr, assignErr] = await Promise.all([
    supabase
      .from('jobs')
      .update({ status: 'completed', operational_phase: 'completed', updated_at: now })
      .eq('id', jobId)
      .then((r) => r.error),
    supabase
      .from('job_assignments')
      .update({ completed_at: now })
      .eq('id', assignmentId)
      .then((r) => r.error),
  ]);

  if (jobErr || assignErr) {
    throw new Error(jobErr?.message ?? assignErr?.message ?? 'Error al finalizar');
  }

  await finishLocally();
};

/**
 * 🔒 Accept a job atomically via RPC (concurrency-safe).
 * Returns success: true or throws with the rejection message.
 */
export const acceptJob = async (
  jobId: string,
  workerId: string,
  workerCtx?: AcceptWorkerContext,
  jobSnapshot?: Job | null,
): Promise<{
  success: boolean;
  assignmentId?: string;
  assignment: JobAssignment;
  pendingClientSelection?: boolean;
}> => {
  let effectiveWorkerId = workerId;
  let effectiveCtx = workerCtx;
  let selectionStatus: 'pending' | 'approved' = 'pending';

  try {
    if (workerCtx) {
      const resolved = await resolveWorkerProfileForActions(workerCtx as UserProfile);
      effectiveWorkerId = resolved.id;
      effectiveCtx = resolved;
      await ensureProfileInDb(resolved);

      const jobCat = jobSnapshot?.category;
      if (jobCat && !workerCoversJobCategory(resolved, jobCat)) {
        throw new Error(
          'Este servicio no está en tus especialidades aprobadas. Pedí al admin que active la categoría o sus sub-servicios.',
        );
      }
    }

    await assertWorkerCanPostulate(effectiveWorkerId);

    const applicantCoords = await captureWorkerApplicantLocation();
    let rpc = await tryRpcAccept(jobId, effectiveWorkerId, applicantCoords);

    const retriable =
      rpc.error?.includes('no encontrado') ||
      rpc.error?.includes('aprobada') ||
      rpc.error?.includes('not found');

    if (!rpc.ok && effectiveCtx && retriable) {
      const reResolved = await resolveWorkerProfileForActions(effectiveCtx as UserProfile);
      effectiveWorkerId = reResolved.id;
      effectiveCtx = reResolved;
      await ensureProfileInDb(reResolved);
      rpc = await tryRpcAccept(jobId, effectiveWorkerId, applicantCoords);
    }

    let assignmentId = rpc.assignmentId;

    if (rpc.ok) {
      selectionStatus =
        rpc.selectionStatus === 'approved' ? 'approved' : 'pending';
    }

    if (!rpc.ok) {
      const alreadyMine =
        rpc.error?.includes('Ya postulaste')
        || rpc.error?.includes('Ya tomaste')
        || rpc.error?.includes('anteriormente');

      const remoteRow = await fetchRemoteAssignmentForJob(jobId, effectiveWorkerId);
      if (remoteRow) {
        const remoteStatus =
          remoteRow.selection_status === 'approved' ? 'approved' : 'pending';
        const assignment = buildAssignment(
          jobId,
          effectiveWorkerId,
          remoteRow.id,
          jobSnapshot ?? null,
          remoteStatus,
        );
        await upsertLocalAssignment(assignment, assignment.job ?? null);
        return {
          success: true,
          assignmentId: remoteRow.id,
          assignment,
          pendingClientSelection: remoteStatus === 'pending',
        };
      }

      if (alreadyMine) {
        const assignment = buildAssignment(
          jobId,
          effectiveWorkerId,
          `${jobId}-${effectiveWorkerId}`,
          jobSnapshot ?? null,
          'pending',
        );
        await upsertLocalAssignment(assignment, assignment.job ?? null);
        return {
          success: true,
          assignmentId: assignment.id,
          assignment,
          pendingClientSelection: true,
        };
      }

      const takenError =
        rpc.error?.includes('tomado')
        || rpc.error?.includes('taken')
        || rpc.error?.includes('lock');

      if (takenError) {
        const remoteMine = (await fetchAssignmentsViaWorkerColumn(effectiveWorkerId))
          .find((a) => a.job_id === jobId);
        if (remoteMine) {
          await upsertLocalAssignment(remoteMine, remoteMine.job ?? null);
          return {
            success: true,
            assignmentId: remoteMine.id,
            assignment: remoteMine,
          };
        }
      }

      if (
        rpc.error?.includes('2 chambas activas')
        || rpc.error?.includes('worker_active_limit')
      ) {
        throw new Error(WORKER_ACTIVE_COMMITMENTS_LIMIT_MESSAGE);
      }

      throw new Error(rpc.error ?? 'No se pudo postular al trabajo');

      const fallback = await acceptJobPilotFallback(jobId, effectiveWorkerId);
      assignmentId = fallback.assignmentId;
      selectionStatus = fallback.selectionStatus;
    }

    let job: Job | null = jobSnapshot ?? null;
    if (!job) {
      try {
        job = await fetchJobById(jobId);
      } catch {
        // seguir con snapshot o caché mínima
      }
    }

    if (job?.status === 'taken' && job.assigned_worker_id === effectiveWorkerId) {
      selectionStatus = 'approved';
    }

    const assignment = buildAssignment(
      jobId,
      effectiveWorkerId,
      assignmentId,
      job,
      selectionStatus,
    );
    await upsertLocalAssignment(assignment, assignment.job ?? null);

    if (selectionStatus === 'approved') {
      await patchLocalOperationalPhase(jobId, 'accepted', 'taken');
    }

    return {
      success: true,
      assignmentId,
      assignment,
      pendingClientSelection: selectionStatus === 'pending',
    };
  } catch (err) {
    throw err;
  }
};

/** Subscribe to real-time job feed updates. */
export const subscribeToJobs = (onUpdate: (job: Job) => void) => {
  const channel = supabase
    .channel('jobs-feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'jobs' },
      (payload) => {
        if (payload.new) onUpdate(normalizeJobRow(payload.new as Job));
      },
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};

export type WorkerRadarJobEvent = 'INSERT' | 'UPDATE' | 'DELETE';

/** Realtime del radar técnico — INSERT/UPDATE/DELETE en `jobs`. */
export const subscribeToWorkerRadarJobs = (
  onEvent: (payload: { job: Job; eventType: WorkerRadarJobEvent }) => void,
) => {
  const channel = supabase
    .channel('worker-radar-jobs')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'jobs' },
      (payload) => {
        if (payload.new) {
          onEvent({ job: normalizeJobRow(payload.new as Job), eventType: 'INSERT' });
        }
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'jobs' },
      (payload) => {
        if (payload.new) {
          onEvent({ job: normalizeJobRow(payload.new as Job), eventType: 'UPDATE' });
        }
      },
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'jobs' },
      (payload) => {
        if (payload.old) {
          onEvent({ job: normalizeJobRow(payload.old as Job), eventType: 'DELETE' });
        }
      },
    )
    .subscribe((status, err) => {
      if (__DEV__ && (err || status === 'CHANNEL_ERROR')) {
        console.warn('[worker-radar-realtime]', err?.message ?? status);
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
};

interface CreateJobParams {
  title: string;
  description: string;
  category: JobCategory;
  payAmount: number;
  address: string;
  /** 0,0 = solo dirección escrita (sin GPS). */
  lat: number;
  lng: number;
  scheduledAt?: string;
  /** Fecha YYYY-MM-DD (opcional; default vía RPC). */
  scheduledDate?: string | null;
  /** Hora HH:mm o HH:mm:ss (opcional). */
  scheduledTime?: string | null;
  /** Urgencia: hoy | manana | programado (default 'hoy'). */
  urgencyLevel?: UrgencyLevel;
  durationHours: number;
  requiredWorkers: number;
  mediaUrls?: string[];
  createdBy: string;
  /** Admin puede omitir validación de precio mínimo sugerido. */
  relaxedPricing?: boolean;
}

/** Admin: Create a new job. */
export const createJob = async (params: CreateJobParams): Promise<Job> => {
  if (!params.relaxedPricing) {
    await assertClientJobPlatformReady();
    const preciosResult = await fetchPreciosCatalogo();
    const dbPrecios = mapPreciosRowsToMap(preciosResult.rows);
    const dbSuggested = resolveOfferSuggestedPriceFromDb(params.category, dbPrecios);
    const priceLookup = dbSuggested != null && dbSuggested > 0
      ? {
          getSuggestedPrice: () => dbSuggested,
          getMinPrice: () => Math.ceil(dbSuggested * 0.7),
        }
      : undefined;
    const priceCheck = validateClientPrice(params.category, params.payAmount, priceLookup);
    if (!priceCheck.valid) {
      throw new Error(priceCheck.message);
    }
  } else if (!Number.isFinite(params.payAmount) || params.payAmount <= 0) {
    throw new Error('Ingresa un monto válido mayor a cero');
  }

  if (!params.relaxedPricing) {
    await assertClientCanPublish(params.createdBy);
  }

  const slugCategory = params.category.trim();
  const categoryAttempts = Array.from(
    new Set([
      slugCategory,
      toDbJobCategory(slugCategory),
      ...toDbJobCategoryQueryValues(slugCategory),
    ]),
  );
  const platformFee   = parseFloat((params.payAmount * 0.05).toFixed(2));
  const workerPayout  = parseFloat((params.payAmount * 0.95).toFixed(2));

  const scheduling = resolveJobScheduling({
    urgencyLevel:  params.urgencyLevel,
    scheduledDate: params.scheduledDate,
    scheduledTime: params.scheduledTime,
    scheduledAt:   params.scheduledAt,
  });

  const rpcBase = {
    p_created_by:       params.createdBy,
    p_title:            params.title,
    p_description:      params.description,
    p_pay_amount:       params.payAmount,
    p_address:          params.address,
    p_lat:              params.lat,
    p_lng:              params.lng,
    p_duration_hours:   params.durationHours,
    p_required_workers: params.requiredWorkers,
    p_scheduled_at:     scheduling.scheduledAt,
    p_media_urls:       params.mediaUrls ?? [],
  };

  let job: Job | null = null;
  let rpcFailedMsg = '';

  for (const cat of categoryAttempts) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('create_client_job', {
      ...rpcBase,
      p_category: cat,
    });
    const rpcBody = parseCreateJobRpc(rpcData);
    rpcFailedMsg = rpcBody?.error ?? rpcErr?.message ?? rpcFailedMsg;

    if (rpcErr) {
      console.warn('[createJob] RPC create_client_job error:', {
        category: cat,
        message: rpcErr.message,
        details: (rpcErr as { details?: string }).details ?? null,
        hint: (rpcErr as { hint?: string }).hint ?? null,
        code: rpcErr.code ?? null,
      });
    } else if (rpcBody && !rpcBody.success) {
      console.warn('[createJob] RPC create_client_job rejected:', {
        category: cat,
        error: rpcBody.error,
      });
    }

    if (!rpcErr && rpcBody?.success && rpcBody.job) {
      job = normalizeJobRow(rpcBody.job);
      break;
    }
  }

  if (!job) {
    if (
      rpcFailedMsg.includes('2 solicitudes activas')
      || rpcFailedMsg.includes('client_active_limit')
    ) {
      throw new Error(CLIENT_ACTIVE_JOBS_LIMIT_MESSAGE);
    }

    let insertError: string | null = null;

    for (const cat of categoryAttempts) {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          title:            params.title,
          description:      params.description,
          category:         cat,
          pay_amount:       params.payAmount,
          platform_fee:     platformFee,
          worker_payout:    workerPayout,
          address:          params.address,
          lat:              params.lat,
          lng:              params.lng,
          scheduled_at:     scheduling.scheduledAt,
          scheduled_date:   scheduling.scheduledDate,
          scheduled_time:   scheduling.scheduledTime,
          urgency_level:    scheduling.urgencyLevel,
          operational_phase: 'pending',
          duration_hours:   params.durationHours,
          required_workers: params.requiredWorkers,
          media_urls:       params.mediaUrls ?? [],
          created_by:       params.createdBy,
          status:           'open',
        })
        .select()
        .single();

      if (!error && data) {
        job = normalizeJobRow(data as Job);
        break;
      }
      if (error) {
        console.warn('[createJob] direct INSERT jobs error:', {
          category: cat,
          message: error.message,
          details: (error as { details?: string }).details ?? null,
          hint: (error as { hint?: string }).hint ?? null,
          code: error.code ?? null,
        });
      }
      insertError = error?.message ?? insertError;
    }

    if (!job) {
      let message = insertError ?? rpcFailedMsg ?? 'No se pudo crear la solicitud';
      if (message.includes('jobs_created_by_fkey') || message.includes('Perfil de cliente no encontrado')) {
        message =
          'Tu perfil de cliente no está sincronizado. Cierra sesión, vuelve a entrar e intenta de nuevo.';
      }
      if (message.includes('job_category')) {
        message = `Categoría no válida en el servidor (${slugCategory}). Contacta soporte.`;
      }
      throw new Error(message);
    }
  }

  try {
    await supabase.functions.invoke('notify-new-job', {
      body: { type: 'INSERT', record: job },
    });
  } catch (notifyErr) {
    console.warn('[createJob] notify-new-job failed:', notifyErr);
  }

  return job;
};

export interface BoostClientJobOfferParams {
  jobId: string;
  clientId: string;
  payAmount: number;
}

/** Impulsa una solicitud open: nuevo presupuesto + reinicia created_at (60 min en radar). */
export const boostClientJobOffer = async ({
  jobId,
  clientId,
  payAmount,
}: BoostClientJobOfferParams): Promise<Job> => {
  const { data, error } = await supabase.rpc('boost_client_job_offer', {
    p_job_id: jobId,
    p_client_id: clientId,
    p_pay_amount: payAmount,
  });

  if (error) {
    throw new Error(error.message);
  }

  const body = data as { success?: boolean; error?: string; job?: Job } | null;
  if (!body?.success || !body.job) {
    throw new Error(body?.error ?? 'No se pudo impulsar la solicitud');
  }

  return normalizeJobRow(body.job);
};

/** Admin: Update job status. */
export const updateJobStatus = async (
  jobId: string,
  status: JobStatus,
): Promise<void> => {
  const { error } = await supabase
    .from('jobs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) throw new Error(error.message);
};

/** Admin: Fetch all jobs (any status). */
export const fetchAllJobs = async (): Promise<Job[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select(`*, creator:profiles!created_by(id, full_name)`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Job[];
};

/** Admin: Fetch assignments for a job. */
export const fetchJobAssignments = async (jobId: string): Promise<JobAssignment[]> => {
  const { data, error } = await supabase
    .from('job_assignments')
    .select(`*, worker:profiles!worker_id(id, full_name, avatar_url, phone)`)
    .eq('job_id', jobId);

  if (error) throw new Error(error.message);
  return (data ?? []) as JobAssignment[];
};

/**
 * Fetch a job + the current worker's assignment in a single parallel call.
 * Used by JobActiveScreen.
 */
export const fetchJobActive = async (
  jobId: string,
  workerId: string,
): Promise<{ job: Job; assignment: JobAssignment }> => {
  const [jobRes, assignRes] = await Promise.all([
    supabase
      .from('jobs')
      .select(`*, creator:profiles!created_by(id, full_name, phone, avatar_url)`)
      .eq('id', jobId)
      .single(),
    supabase
      .from('job_assignments')
      .select('*')
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
      .single(),
  ]);

  if (jobRes.error) throw new Error(jobRes.error.message);

  const normalizedJob = normalizeJobRow(jobRes.data as Job);

  if (assignRes.error) {
    const local = await getLocalAssignments(workerId);
    const found = local.find((a) => a.job_id === jobId);
    if (found) {
      const job = found.job
        ? normalizeJobRow(found.job as Job)
        : normalizedJob;
      return { job, assignment: found };
    }
    throw new Error(assignRes.error.message);
  }

  const assignment = assignRes.data as JobAssignment;
  const local = await getLocalAssignments(workerId);
  const cached = local.find((a) => a.job_id === jobId);
  if (cached?.job) {
    const cachedJob = normalizeJobRow(cached.job as Job);
    if (
      cachedJob.status !== normalizedJob.status
      || cachedJob.operational_phase !== normalizedJob.operational_phase
    ) {
      return {
        job: {
          ...normalizedJob,
          status: cachedJob.status ?? normalizedJob.status,
          operational_phase:
            cachedJob.operational_phase ?? normalizedJob.operational_phase,
        },
        assignment,
      };
    }
  }

  return { job: normalizedJob, assignment };
};

const attachWorkersToClientJobs = async (jobs: ClientOrderJob[]): Promise<ClientOrderJob[]> => {
  if (jobs.length === 0) return jobs;

  const enriched = jobs.map((j) => ({ ...j }));

  const missingIds = enriched
    .filter((j) => !j.assigned_worker && j.status !== 'open')
    .map((j) => j.id);

  if (missingIds.length === 0) return enriched;

  const { data: assigns } = await supabase
    .from('job_assignments')
    .select(`
      job_id,
      worker_id,
      worker:profiles!worker_id(id, full_name, avatar_url, phone)
    `)
    .in('job_id', missingIds);

  const byJob = new Map<string, AssignedWorkerSummary>();
  for (const row of assigns ?? []) {
    const raw = row as { job_id: string; worker?: AssignedWorkerSummary | AssignedWorkerSummary[] | null };
    const w = Array.isArray(raw.worker) ? raw.worker[0] : raw.worker;
    if (w?.id) byJob.set(raw.job_id, w);
  }

  return enriched.map((job) => {
    if (job.assigned_worker) return job;
    const worker = byJob.get(job.id);
    if (!worker) return job;
    return {
      ...job,
      assigned_worker_id: worker.id,
      assigned_worker: worker,
    };
  });
};

const fetchClientOrdersForId = async (clientId: string): Promise<ClientOrderJob[]> => {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_client_jobs', {
    p_client_id: clientId,
  });

  if (!rpcErr && Array.isArray(rpcData)) {
    return (rpcData as ClientOrderJob[]).map((row) => normalizeJobRow(row));
  }

  if (rpcErr) {
    console.warn('[fetchClientOrders] RPC get_client_jobs:', rpcErr.message);
  }

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      assigned_worker:profiles!assigned_worker_id(id, full_name, avatar_url, phone)
    `)
    .eq('created_by', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[fetchClientOrders] SELECT jobs:', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const { assigned_worker: rawWorker, ...rest } = row as ClientOrderJob & {
      assigned_worker?: AssignedWorkerSummary | AssignedWorkerSummary[] | null;
    };
    const assigned_worker = unwrapAssignedWorker(rawWorker);
    const job = normalizeJobRow(rest as Job);
    return {
      ...job,
      assigned_worker_id: (row as ClientOrderJob).assigned_worker_id ?? assigned_worker?.id ?? null,
      assigned_worker,
    };
  });
};

const mapClientOrdersPanelRow = (row: ClientOrderJob & {
  assigned_worker?: AssignedWorkerSummary | AssignedWorkerSummary[] | null;
}): ClientOrderJob => {
  const { assigned_worker: rawWorker, ...rest } = row;
  const assigned_worker = unwrapAssignedWorker(rawWorker);
  const job = normalizeJobRow(rest as Job);
  return {
    ...job,
    assigned_worker_id: row.assigned_worker_id ?? assigned_worker?.id ?? null,
    assigned_worker,
  };
};

/** Pedidos del cliente con técnico asignado (para calificar). */
export const fetchClientOrders = async (clientId: string): Promise<ClientOrderJob[]> => {
  if (!clientId) return [];

  await assertClientJobPlatformReady();

  let effectiveId = clientId;
  const profile = useAuthStore.getState().profile;
  if (profile) {
    try {
      const synced = await withTimeout(syncProfileWithDatabase(profile), 3_000).catch(() => profile);
      effectiveId = synced.id;
    } catch {
      effectiveId = clientId;
    }
  }

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('get_client_orders_panel', { p_client_id: effectiveId }),
      8_000,
    );
    if (!error && data) {
      const rows = Array.isArray(data)
        ? data
        : typeof data === 'string'
          ? (JSON.parse(data) as unknown[])
          : [];
      if (rows.length > 0) {
        return rows.map((row) => mapClientOrdersPanelRow(row as ClientOrderJob));
      }
    }
    if (error) {
      console.warn('[fetchClientOrders] panel RPC:', error.message);
    }
  } catch (err) {
    console.warn('[fetchClientOrders] panel RPC timeout:', err);
  }

  try {
    const jobs = await withTimeout(fetchClientOrdersForId(effectiveId), 8_000);
    return await withTimeout(attachWorkersToClientJobs(jobs), 4_000);
  } catch {
    try {
      return await fetchClientOrdersForId(effectiveId);
    } catch {
      return [];
    }
  }
};

/** Resumen de chamba completada para el cliente (historial). */
export const fetchClientJobSummary = async (
  jobId: string,
  clientId: string,
): Promise<ClientJobSummary> => {
  const { data: jobRow, error: jobErr } = await supabase
    .from('jobs')
    .select(`
      *,
      assigned_worker:profiles!assigned_worker_id(id, full_name, avatar_url, phone)
    `)
    .eq('id', jobId)
    .eq('created_by', clientId)
    .single();

  if (jobErr || !jobRow) {
    throw new Error(jobErr?.message ?? 'Solicitud no encontrada');
  }

  const { assigned_worker: rawWorker, ...rest } = jobRow as ClientOrderJob & {
    assigned_worker?: AssignedWorkerSummary | AssignedWorkerSummary[] | null;
  };
  const assigned_worker = unwrapAssignedWorker(rawWorker);
  const job = normalizeJobRow(rest as Job) as ClientOrderJob;
  job.assigned_worker = assigned_worker;
  job.assigned_worker_id = job.assigned_worker_id ?? assigned_worker?.id ?? null;

  let completed_at: string | null =
    job.status === 'completed' ? (job.updated_at ?? null) : null;

  const { data: assignRow } = await supabase
    .from('job_assignments')
    .select('completed_at, worker_id')
    .eq('job_id', jobId)
    .maybeSingle();

  if (assignRow?.completed_at) {
    completed_at = assignRow.completed_at;
  }

  const workerId = job.assigned_worker?.id ?? assignRow?.worker_id;
  let client_review: WorkerReview | null = null;
  let worker_rating_avg: number | null = null;

  if (workerId) {
    const [reviews, summary] = await Promise.all([
      fetchWorkerReviews(workerId),
      fetchWorkerRatingSummary(workerId),
    ]);
    client_review = reviews.find((r) => r.reviewer_id === clientId) ?? null;
    worker_rating_avg = summary.rating_avg;
  }

  return {
    job,
    completed_at,
    client_review,
    worker_rating_avg,
  };
};
