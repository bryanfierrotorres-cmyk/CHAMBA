import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import { withTimeout } from '@utils/withTimeout';
import type { Job, JobModerationReason, UserProfile } from '@/types';

export type AdminModerationReason = Exclude<JobModerationReason, 'admin'>;

const RPC_TIMEOUT_MS = 10_000;

const parseJsonArray = <T>(raw: unknown): T[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const adminActorId = (): string | undefined => useAuthStore.getState().profile?.id;

const parseRpcSuccess = (raw: unknown): { ok: boolean; error?: string } => {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Respuesta inválida' };
  const body = raw as { success?: boolean; error?: string };
  return { ok: !!body.success, error: body.error };
};

// ─── Admin Job (with nested worker assignment) ────────────────────────────────

export interface AdminAssignment {
  id: string;
  worker_id: string;
  assigned_at: string;
  completed_at: string | null;
  payment_status: 'pending' | 'processing' | 'paid' | 'failed';
  worker: Pick<UserProfile, 'id' | 'full_name' | 'phone' | 'avatar_url'> | null;
}

export interface AdminJob extends Job {
  assignments: AdminAssignment[];
}

/** Fetch all workers (for admin panel). */
export const fetchAllWorkers = async (): Promise<UserProfile[]> => {
  const adminId = adminActorId();
  if (adminId) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_admin_team_profiles', { p_admin_id: adminId, p_role: 'worker' }),
        RPC_TIMEOUT_MS,
      );
      if (!error && data) {
        const rows = parseJsonArray<UserProfile>(data);
        if (rows.length > 0 || data !== null) return rows;
      }
      if (error) console.warn('[fetchAllWorkers] RPC:', error.message);
    } catch (err) {
      console.warn('[fetchAllWorkers] RPC timeout:', err);
    }
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'worker')
        .order('created_at', { ascending: false }),
      RPC_TIMEOUT_MS,
    );
    if (error) throw new Error(error.message);
    return (data ?? []) as UserProfile[];
  } catch (err) {
    console.warn('[fetchAllWorkers] fallback:', err);
    return [];
  }
};

/** Fetch all clients (registro con aprobación). */
export const fetchAllClients = async (): Promise<UserProfile[]> => {
  const adminId = adminActorId();
  if (adminId) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_admin_team_profiles', { p_admin_id: adminId, p_role: 'client' }),
        RPC_TIMEOUT_MS,
      );
      if (!error && data) {
        const rows = parseJsonArray<UserProfile>(data);
        if (rows.length > 0 || data !== null) return rows;
      }
      if (error) console.warn('[fetchAllClients] RPC:', error.message);
    } catch (err) {
      console.warn('[fetchAllClients] RPC timeout:', err);
    }
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false }),
      RPC_TIMEOUT_MS,
    );
    if (error) throw new Error(error.message);
    return (data ?? []) as UserProfile[];
  } catch (err) {
    console.warn('[fetchAllClients] fallback:', err);
    return [];
  }
};

/** Aprobar o suspender cliente (sin campos de técnico). */
export const toggleClientApproval = async (
  clientId: string,
  approve: boolean,
): Promise<void> => {
  const adminId = adminActorId();
  if (adminId) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('admin_set_profile_approval', {
          p_admin_id: adminId,
          p_profile_id: clientId,
          p_approve: approve,
          p_role: 'client',
        }),
        RPC_TIMEOUT_MS,
      );
      if (!error && data) {
        const { ok, error: rpcErr } = parseRpcSuccess(data);
        if (ok) return;
        if (rpcErr) throw new Error(rpcErr);
      }
    } catch (err) {
      if (err instanceof Error && !/timeout/i.test(err.message)) throw err;
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved: approve,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)
    .eq('role', 'client');

  if (error) throw new Error(error.message);
};

/** Toggle worker approval status and mark active. */
export const toggleWorkerApproval = async (
  workerId: string,
  approve: boolean,
): Promise<void> => {
  const adminId = adminActorId();
  if (adminId) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('admin_set_profile_approval', {
          p_admin_id: adminId,
          p_profile_id: workerId,
          p_approve: approve,
          p_role: 'worker',
        }),
        RPC_TIMEOUT_MS,
      );
      if (!error && data) {
        const { ok, error: rpcErr } = parseRpcSuccess(data);
        if (ok) return;
        if (rpcErr) throw new Error(rpcErr);
      }
    } catch (err) {
      if (err instanceof Error && !/timeout/i.test(err.message)) throw err;
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved:   approve,
      worker_status: approve ? 'active' : 'suspended',
      ...(approve ? { category_1_approved: true } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', workerId);

  if (error) throw new Error(error.message);
};

/** Approve (or revoke) a worker's second category only. */
export const approveWorkerCategory2 = async (
  workerId: string,
  approve: boolean,
): Promise<void> => {
  const adminId = adminActorId();
  if (adminId) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('admin_set_worker_category2', {
          p_admin_id: adminId,
          p_worker_id: workerId,
          p_approve: approve,
        }),
        RPC_TIMEOUT_MS,
      );
      if (!error && data) {
        const { ok, error: rpcErr } = parseRpcSuccess(data);
        if (ok) return;
        if (rpcErr) throw new Error(rpcErr);
      }
    } catch (err) {
      if (err instanceof Error && !/timeout/i.test(err.message)) throw err;
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ category_2_approved: approve, updated_at: new Date().toISOString() })
    .eq('id', workerId);

  if (error) throw new Error(error.message);
};

/** Admin dashboard stats. */
export interface DashboardStats {
  totalJobs: number;
  openJobs: number;
  takenJobs: number;
  completedJobs: number;
  totalWorkers: number;
  approvedWorkers: number;
  totalRevenue: number;
}

/**
 * Fetch all jobs with their worker assignments (for the admin control panel).
 * Returns jobs ordered by created_at desc, each with nested assignments.
 */
const parseAdminJobsRpc = (raw: unknown): AdminJob[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as AdminJob[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AdminJob[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const fetchAdminJobs = async (): Promise<AdminJob[]> => {
  const adminId = useAuthStore.getState().profile?.id;

  if (adminId) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_admin_control_jobs', { p_admin_id: adminId }),
        8_000,
      );
      if (!error && data) {
        const rows = parseAdminJobsRpc(data);
        return rows;
      }
      if (error) {
        console.warn('[fetchAdminJobs] RPC:', error.message);
      }
    } catch (err) {
      console.warn('[fetchAdminJobs] RPC timeout:', err);
    }
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('jobs')
        .select(`
          *,
          creator:profiles!created_by(id, full_name),
          assignments:job_assignments(
            id, worker_id, assigned_at, completed_at, payment_status,
            worker:profiles!worker_id(id, full_name, phone, avatar_url)
          )
        `)
        .order('created_at', { ascending: false }),
      8_000,
    );

    if (error) throw new Error(error.message);
    return (data ?? []) as AdminJob[];
  } catch (err) {
    console.warn('[fetchAdminJobs] fallback:', err);
    return [];
  }
};

export const adminRemoveOpenJob = async (
  jobId: string,
  adminId: string,
  reason: AdminModerationReason = 'spam',
): Promise<Job> => {
  const { data, error } = await supabase.rpc('admin_moderate_remove_job', {
    p_job_id: jobId,
    p_admin_id: adminId,
    p_reason: reason,
  });

  if (error) throw new Error(error.message);

  const body = data as { success?: boolean; job?: Job; error?: string };
  if (!body?.success || !body.job) {
    throw new Error(body?.error ?? 'No se pudo retirar el servicio');
  }

  return body.job;
};

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const [jobsResult, workersResult, assignmentsResult] = await Promise.all([
    supabase.from('jobs').select('status, pay_amount'),
    supabase.from('profiles').select('is_approved').eq('role', 'worker'),
    supabase.from('job_assignments').select('payment_status, job:jobs(pay_amount)'),
  ]);

  const jobs       = jobsResult.data ?? [];
  const workers    = workersResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];

  const openJobs      = jobs.filter((j) => j.status === 'open').length;
  const takenJobs     = jobs.filter((j) => j.status === 'taken').length;
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;

  const totalRevenue = assignments
    .filter((a: any) => a.payment_status === 'paid')
    .reduce((sum: number, a: any) => {
      const payAmount = a.job?.pay_amount ?? 0;
      return sum + payAmount * 0.05; // Platform 5% commission
    }, 0);

  return {
    totalJobs:        jobs.length,
    openJobs,
    takenJobs,
    completedJobs,
    totalWorkers:     workers.length,
    approvedWorkers:  workers.filter((w: any) => w.is_approved).length,
    totalRevenue,
  };
};
