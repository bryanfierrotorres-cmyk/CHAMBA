import { supabase } from '@services/supabase';
import type { Job, UserProfile } from '@/types';

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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'worker')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as UserProfile[];
};

/** Fetch all clients (registro con aprobación). */
export const fetchAllClients = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'client')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as UserProfile[];
};

/** Aprobar o suspender cliente (sin campos de técnico). */
export const toggleClientApproval = async (
  clientId: string,
  approve: boolean,
): Promise<void> => {
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
  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved:   approve,
      worker_status: approve ? 'active' : 'suspended',
      // When approving, also mark category_1 as approved
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
export const fetchAdminJobs = async (): Promise<AdminJob[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      creator:profiles!created_by(id, full_name),
      assignments:job_assignments(
        id, worker_id, assigned_at, completed_at, payment_status,
        worker:profiles!worker_id(id, full_name, phone, avatar_url)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminJob[];
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
