import { supabase } from '@services/supabase';
import type { Job, JobAssignment, JobCategory, JobStatus, PaginatedResponse, ClientOrderJob, AssignedWorkerSummary } from '@/types';
import { validateClientPrice } from '@constants/servicePricing';
import { fromDbJobCategory, toDbJobCategory, toDbJobCategoryQueryValues } from '@constants/chambaCategories';
import {
  getLocalAssignments,
  getAllLocalAssignments,
  upsertLocalAssignment,
  patchLocalJobStatus,
  mergeAssignments,
} from '@utils/localAssignments';
import { CONFIG } from '@constants/config';
import { ensureWorkerProfileInDb, resolveWorkerProfileForActions, persistPilotProfileIfChanged } from '@utils/profileSync';
import type { UserProfile } from '@/types';

type AcceptWorkerContext = Pick<
  UserProfile,
  'id' | 'full_name' | 'phone' | 'email' | 'role' | 'is_approved'
>;

const PAGE_SIZE = 20;

const normalizeJobRow = (row: Job & { address?: string; lat?: number; lng?: number }): Job => {
  const raw = row as Job & { address?: string; lat?: number; lng?: number };
  const address = raw.location?.address ?? raw.address ?? '';
  const lat = raw.location?.lat ?? raw.lat ?? 0;
  const lng = raw.location?.lng ?? raw.lng ?? 0;

  return {
    ...row,
    category: (fromDbJobCategory(row.category as string) ?? row.category) as JobCategory,
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
  const { data, error } = await supabase.rpc('get_worker_assignments', {
    p_worker_id: workerId,
  });

  if (error) {
    console.warn('[fetchWorkerAssignments] RPC get_worker_assignments:', error.message);
    return [];
  }

  const rows = parseRpcAssignmentRows(data);
  return rows.map((row) => ({
    ...row,
    job: row.job ? normalizeJobRow(row.job as Job) : row.job,
  }));
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
    return {
      id: `${job.id}-${workerId}`,
      job_id: job.id,
      worker_id: workerId,
      assigned_at: job.updated_at ?? job.created_at,
      completed_at: job.status === 'completed' ? (job.updated_at ?? null) : null,
      payment_status: 'pending' as const,
      payment_intent_id: null,
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
}

/** Fetch paginated jobs. */
export const fetchJobs = async ({
  status = 'open',
  category,
  categories,
  page = 0,
}: FetchJobsParams = {}): Promise<PaginatedResponse<Job>> => {
  let query = supabase
    .from('jobs')
    .select(
      `*, creator:profiles!created_by(id, full_name, avatar_url)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (status) query = query.eq('status', status);

  if (categories !== undefined && categories.length === 0) {
    return {
      data: [],
      count: 0,
      page,
      pageSize: PAGE_SIZE,
      hasMore: false,
    };
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
  if (error) throw new Error(error.message);

  return {
    data: ((data ?? []) as Job[]).map(normalizeJobRow),
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
): Promise<JobAssignment[]> => {
  let localFirst = await getLocalAssignments(workerId);
  if (localFirst.length === 0 && CONFIG.pilot.enabled) {
    localFirst = await getAllLocalAssignments();
  }

  let remote: JobAssignment[] = [];

  try {
    const viaRpc = await fetchAssignmentsViaRpc(workerId);
    if (viaRpc.length > 0) {
      remote = viaRpc;
    } else {
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`*, job:jobs(*)`)
        .eq('worker_id', workerId)
        .order('assigned_at', { ascending: false });

      if (!error && (data ?? []).length > 0) {
        remote = (data ?? []) as JobAssignment[];
      } else {
        remote = await fetchAssignmentsViaJobs(workerId);
        if (remote.length === 0) {
          remote = await fetchAssignmentsViaWorkerColumn(workerId);
        }
      }
    }

    remote = remote.map((a) => ({
      ...a,
      job: a.job ? normalizeJobRow(a.job as Job) : a.job,
    }));

    // No persistir todo el remoto en localStorage (evita quota exceeded).
    // La caché local solo se escribe al aceptar/finalizar.
  } catch (err) {
    console.warn('[fetchWorkerAssignments]', err);
  }

  const local = await getLocalAssignments(workerId);
  const localPool = local.length > 0 ? local : localFirst;
  const merged = mergeAssignments(remote, localPool);
  return merged.length > 0 ? merged : localPool;
};

const tryRpcAccept = async (
  jobId: string,
  workerId: string,
): Promise<{ ok: boolean; assignmentId?: string; error?: string }> => {
  const { data, error } = await supabase.rpc('accept_job', {
    p_job_id: jobId,
    p_worker_id: workerId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as { success?: boolean; error?: string; assignment_id?: string } | null;
  if (!result?.success) {
    return { ok: false, error: result?.error ?? 'No se pudo tomar el trabajo' };
  }

  return { ok: true, assignmentId: result.assignment_id };
};

const buildAssignment = (
  jobId: string,
  workerId: string,
  assignmentId: string | undefined,
  job: Job | null,
): JobAssignment => {
  const now = new Date().toISOString();
  return {
    id: assignmentId ?? `${jobId}-${workerId}`,
    job_id: jobId,
    worker_id: workerId,
    assigned_at: now,
    completed_at: null,
    payment_status: 'pending',
    payment_intent_id: null,
    job: job
      ? { ...job, status: 'in_progress' as JobStatus, updated_at: now }
      : undefined,
  };
};

const acceptJobPilotFallback = async (
  jobId: string,
  workerId: string,
): Promise<{ assignmentId?: string }> => {
  const now = new Date().toISOString();
  const patch = {
    status: 'in_progress' as JobStatus,
    updated_at: now,
    assigned_worker_id: workerId,
  };

  let { error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', jobId)
    .in('status', ['open', 'taken']);

  if (error) {
    const retry = await supabase
      .from('jobs')
      .update({ status: 'taken', updated_at: now, assigned_worker_id: workerId })
      .eq('id', jobId)
      .eq('status', 'open');
    error = retry.error;
  }

  if (error && CONFIG.pilot.enabled) {
    console.warn('[acceptJobPilotFallback]', error.message);
    return { assignmentId: `${jobId}-${workerId}` };
  }

  if (error) {
    throw new Error(error.message);
  }

  return { assignmentId: `${jobId}-${workerId}` };
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

/** Worker: Mark a job as completed (Finalizado). */
export const completeJob = async (
  jobId: string,
  assignmentId: string,
  workerId?: string,
): Promise<void> => {
  const now = new Date().toISOString();
  await patchLocalJobStatus(jobId, 'completed', now);

  if (CONFIG.pilot.enabled) {
    void (async () => {
      if (workerId) {
        const { data, error } = await supabase.rpc('worker_complete_job', {
          p_job_id: jobId,
          p_worker_id: workerId,
          p_assignment_id: assignmentId,
        });
        if (!error && (data as { success?: boolean })?.success) return;
      }
      await supabase
        .from('jobs')
        .update({ status: 'completed', updated_at: now })
        .eq('id', jobId);
    })();
    return;
  }

  if (workerId) {
    const { data, error } = await supabase.rpc('worker_complete_job', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_assignment_id: assignmentId,
    });
    if (!error && (data as { success?: boolean })?.success) return;
  }

  const [jobErr, assignErr] = await Promise.all([
    supabase
      .from('jobs')
      .update({ status: 'completed', updated_at: now })
      .eq('id', jobId)
      .then((r) => r.error),
    supabase
      .from('job_assignments')
      .update({ completed_at: now })
      .eq('id', assignmentId)
      .then((r) => r.error),
  ]);

  if (jobErr || assignErr) {
    if (workerId) return;
    throw new Error(jobErr?.message ?? assignErr?.message ?? 'Error al finalizar');
  }
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
): Promise<{ success: boolean; assignmentId?: string; assignment: JobAssignment }> => {
  let effectiveWorkerId = workerId;
  let effectiveCtx = workerCtx;

  try {
    if (workerCtx) {
      const resolved = await resolveWorkerProfileForActions(workerCtx as UserProfile);
      effectiveWorkerId = resolved.id;
      effectiveCtx = resolved;
      await persistPilotProfileIfChanged(workerCtx as UserProfile, resolved);
      await ensureWorkerProfileInDb(resolved);
    }

    let rpc = await tryRpcAccept(jobId, effectiveWorkerId);

    const retriable =
      rpc.error?.includes('no encontrado') ||
      rpc.error?.includes('aprobada') ||
      rpc.error?.includes('not found');

    if (!rpc.ok && CONFIG.pilot.enabled && effectiveCtx && retriable) {
      const reResolved = await resolveWorkerProfileForActions(effectiveCtx as UserProfile);
      effectiveWorkerId = reResolved.id;
      effectiveCtx = reResolved;
      if (workerCtx) {
        await persistPilotProfileIfChanged(workerCtx as UserProfile, reResolved);
      }
      await ensureWorkerProfileInDb(reResolved);
      rpc = await tryRpcAccept(jobId, effectiveWorkerId);
    }

    let assignmentId = rpc.assignmentId;

    if (!rpc.ok) {
      const localExisting = (await getLocalAssignments(effectiveWorkerId)).find(
        (a) => a.job_id === jobId,
      );
      if (localExisting) {
        return {
          success: true,
          assignmentId: localExisting.id,
          assignment: localExisting,
        };
      }

      const alreadyMine =
        rpc.error?.includes('Ya tomaste') ||
        rpc.error?.includes('anteriormente');
      if (alreadyMine) {
        const assignment = buildAssignment(
          jobId,
          effectiveWorkerId,
          `${jobId}-${effectiveWorkerId}`,
          jobSnapshot ?? null,
        );
        await upsertLocalAssignment(assignment, assignment.job ?? null);
        return { success: true, assignmentId: assignment.id, assignment };
      }

      const takenError =
        rpc.error?.includes('tomado') ||
        rpc.error?.includes('taken') ||
        rpc.error?.includes('lock');

      if (takenError && CONFIG.pilot.enabled) {
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
        const localMine = (await getLocalAssignments(effectiveWorkerId))
          .find((a) => a.job_id === jobId);
        if (localMine) {
          return {
            success: true,
            assignmentId: localMine.id,
            assignment: localMine,
          };
        }
      }

      if (!CONFIG.pilot.enabled) {
        throw new Error(rpc.error ?? 'No se pudo tomar el trabajo');
      }

      const fallback = await acceptJobPilotFallback(jobId, effectiveWorkerId);
      assignmentId = fallback.assignmentId;
    }

    let job: Job | null = jobSnapshot ?? null;
    if (!job) {
      try {
        job = await fetchJobById(jobId);
      } catch {
        // seguir con snapshot o caché mínima
      }
    }

    const assignment = buildAssignment(jobId, effectiveWorkerId, assignmentId, job);
    await upsertLocalAssignment(assignment, assignment.job ?? null);

    try {
      await startJob(jobId, effectiveWorkerId);
    } catch (startErr) {
      console.warn('[acceptJob] start after accept:', startErr);
      await patchLocalJobStatus(jobId, 'in_progress');
    }

    return { success: true, assignmentId, assignment };
  } catch (err) {
    if (CONFIG.pilot.enabled) {
      const fallbackJob = jobSnapshot ?? null;
      const assignment = buildAssignment(
        jobId,
        effectiveWorkerId,
        `${jobId}-${effectiveWorkerId}`,
        fallbackJob,
      );
      await upsertLocalAssignment(assignment, assignment.job ?? null);
      return { success: true, assignmentId: assignment.id, assignment };
    }
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

interface CreateJobParams {
  title: string;
  description: string;
  category: JobCategory;
  payAmount: number;
  address: string;
  lat: number;
  lng: number;
  scheduledAt?: string;
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
    const priceCheck = validateClientPrice(params.category, params.payAmount);
    if (!priceCheck.valid) {
      throw new Error(priceCheck.message);
    }
  } else if (!Number.isFinite(params.payAmount) || params.payAmount <= 0) {
    throw new Error('Ingresa un monto válido mayor a cero');
  }

  const dbCategory = toDbJobCategory(params.category);
  const platformFee   = parseFloat((params.payAmount * 0.05).toFixed(2));
  const workerPayout  = parseFloat((params.payAmount * 0.95).toFixed(2));

  const rpcPayload = {
    p_created_by:       params.createdBy,
    p_title:            params.title,
    p_description:      params.description,
    p_category:         dbCategory,
    p_pay_amount:       params.payAmount,
    p_address:          params.address,
    p_lat:              params.lat,
    p_lng:              params.lng,
    p_duration_hours:   params.durationHours,
    p_required_workers: params.requiredWorkers,
    p_scheduled_at:     params.scheduledAt ?? null,
    p_media_urls:       params.mediaUrls ?? [],
  };

  const { data: rpcData, error: rpcErr } = await supabase.rpc('create_client_job', rpcPayload);

  let job: Job;

  if (!rpcErr && rpcData && (rpcData as { success?: boolean }).success) {
    job = normalizeJobRow((rpcData as { job: Job }).job);
  } else {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        title:            params.title,
        description:      params.description,
        category:         dbCategory,
        pay_amount:       params.payAmount,
        platform_fee:     platformFee,
        worker_payout:    workerPayout,
        address:          params.address,
        lat:              params.lat,
        lng:              params.lng,
        scheduled_at:     params.scheduledAt ?? null,
        duration_hours:   params.durationHours,
        required_workers: params.requiredWorkers,
        media_urls:       params.mediaUrls ?? [],
        created_by:       params.createdBy,
        status:           'open',
      })
      .select()
      .single();

    if (error) {
      const hint = rpcErr?.message ?? (rpcData as { error?: string })?.error;
      let message = hint ? `${error.message} (${hint})` : error.message;
      if (message.includes('jobs_created_by_fkey')) {
        message = 'Tu sesión de administrador no está registrada. Cierra sesión e ingresa de nuevo.';
      }
      if (message.includes('job_category')) {
        message = `Categoría no válida en el servidor (${dbCategory}). Contacta soporte.`;
      }
      throw new Error(message);
    }
    job = normalizeJobRow(data as Job);
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

  if (assignRes.error) {
    const local = await getLocalAssignments(workerId);
    const found = local.find((a) => a.job_id === jobId);
    if (found) {
      return {
        job: (found.job ?? jobRes.data) as Job,
        assignment: found,
      };
    }
    throw new Error(assignRes.error.message);
  }

  const job = jobRes.data as Job;
  const assignment = assignRes.data as JobAssignment;
  const local = await getLocalAssignments(workerId);
  const cached = local.find((a) => a.job_id === jobId);
  if (cached?.job && cached.job.status !== job.status) {
    return { job: { ...job, status: cached.job.status ?? job.status }, assignment };
  }

  return { job, assignment };
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

/** Pedidos del cliente con técnico asignado (para calificar). */
export const fetchClientOrders = async (clientId: string): Promise<ClientOrderJob[]> => {
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_client_jobs', {
    p_client_id: clientId,
  });

  let jobs: ClientOrderJob[] = [];

  if (!rpcErr && Array.isArray(rpcData)) {
    jobs = (rpcData as ClientOrderJob[]).map((row) => normalizeJobRow(row));
  } else {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        assigned_worker:profiles!assigned_worker_id(id, full_name, avatar_url, phone)
      `)
      .eq('created_by', clientId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    jobs = (data ?? []).map((row) => {
      const { assigned_worker, ...rest } = row as ClientOrderJob & {
        assigned_worker?: AssignedWorkerSummary | null;
      };
      const job = normalizeJobRow(rest as Job);
      return {
        ...job,
        assigned_worker_id: (row as ClientOrderJob).assigned_worker_id ?? assigned_worker?.id ?? null,
        assigned_worker: assigned_worker ?? null,
      };
    });
  }

  return attachWorkersToClientJobs(jobs);
};
