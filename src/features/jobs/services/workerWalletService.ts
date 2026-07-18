import { supabase } from '@services/supabase';
import { ENV } from '@utils/env';
import { demoDb } from '@/demo/demoDb';
import type { JobCategory } from '@/types';

const IS_DEMO = ENV.DATA_MODE === 'demo';

export type WorkerWalletPaymentStatus = 'pending' | 'processing' | 'paid' | 'failed';

/** Ganancia de un trabajo completado — filtrado en Supabase. */
export interface WorkerWalletEarning {
  id: string;
  jobId: string;
  workerId: string;
  assignedAt: string;
  completedAt: string | null;
  paymentStatus: WorkerWalletPaymentStatus;
  title: string;
  category: JobCategory;
  workerPayout: number;
  jobUpdatedAt: string;
}

const WALLET_EARNINGS_SELECT = `
  id,
  job_id,
  worker_id,
  assigned_at,
  completed_at,
  payment_status,
  job:jobs!inner (
    id,
    title,
    category,
    status,
    worker_payout,
    updated_at
  )
`;

type WalletJobRow = {
  id: string;
  title: string;
  category: JobCategory;
  status: string;
  worker_payout: number;
  updated_at: string;
};

type WalletRow = {
  id: string;
  job_id: string;
  worker_id: string;
  assigned_at: string;
  completed_at: string | null;
  payment_status: WorkerWalletPaymentStatus;
  job: WalletJobRow;
};

const normalizeWalletRow = (raw: {
  id: string;
  job_id: string;
  worker_id: string;
  assigned_at: string;
  completed_at: string | null;
  payment_status: WorkerWalletPaymentStatus;
  job: WalletJobRow | WalletJobRow[] | null;
}): WalletRow | null => {
  const job = Array.isArray(raw.job) ? raw.job[0] : raw.job;
  if (!job) return null;
  return { ...raw, job };
};

const mapWalletRow = (row: WalletRow): WorkerWalletEarning => ({
  id: row.id,
  jobId: row.job_id,
  workerId: row.worker_id,
  assignedAt: row.assigned_at,
  completedAt: row.completed_at,
  paymentStatus: row.payment_status,
  title: row.job.title?.trim() || 'Servicio completado',
  category: row.job.category,
  workerPayout: Number(row.job.worker_payout) || 0,
  jobUpdatedAt: row.job.updated_at,
});

/**
 * Consulta directa: asignaciones del técnico con jobs completados.
 * El filtro pesado ocurre en Supabase (worker_id + status completed).
 */
export const fetchWorkerWalletEarnings = async (
  workerId: string,
): Promise<WorkerWalletEarning[]> => {
  if (IS_DEMO) {
    const assignments = await demoDb.listWorkerAssignments(workerId);
    return assignments
      .filter((a) => a.selection_status === 'approved' && a.job?.status === 'completed' && a.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .map((a) => ({
        id: a.id,
        jobId: a.job_id,
        workerId: a.worker_id,
        assignedAt: a.assigned_at,
        completedAt: a.completed_at,
        paymentStatus: a.payment_status,
        title: a.job?.title?.trim() || 'Servicio completado',
        category: (a.job?.category ?? 'otro') as JobCategory,
        workerPayout: Number(a.job?.worker_payout) || 0,
        jobUpdatedAt: a.job?.updated_at ?? a.assigned_at,
      }));
  }

  const { data, error } = await supabase
    .from('job_assignments')
    .select(WALLET_EARNINGS_SELECT)
    .eq('worker_id', workerId)
    .eq('selection_status', 'approved')
    .eq('job.status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => normalizeWalletRow(row as Parameters<typeof normalizeWalletRow>[0]))
    .filter((row): row is WalletRow => row != null)
    .map(mapWalletRow);
};
