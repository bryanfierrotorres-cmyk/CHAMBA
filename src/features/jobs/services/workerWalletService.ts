import { supabase } from '@services/supabase';
import type { JobCategory } from '@/types';

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

type WalletRow = {
  id: string;
  job_id: string;
  worker_id: string;
  assigned_at: string;
  completed_at: string | null;
  payment_status: WorkerWalletPaymentStatus;
  job: {
    id: string;
    title: string;
    category: JobCategory;
    status: string;
    worker_payout: number;
    updated_at: string;
  };
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
  const { data, error } = await supabase
    .from('job_assignments')
    .select(WALLET_EARNINGS_SELECT)
    .eq('worker_id', workerId)
    .eq('job.status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as WalletRow[]).map(mapWalletRow);
};
