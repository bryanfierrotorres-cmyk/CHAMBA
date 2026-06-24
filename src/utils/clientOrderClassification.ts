import type { ClientOrderJob, JobStatus } from '@/types';

/** Solicitud publicada sin técnico elegido aún. */
export const isClientOrderPending = (
  job: Pick<ClientOrderJob, 'status' | 'assigned_worker_id'>,
): boolean =>
  job.status === 'open' && !job.assigned_worker_id;

/** Servicio en ejecución (técnico asignado, negociando, o trabajo en curso). */
export const isClientOrderActive = (
  job: Pick<ClientOrderJob, 'status' | 'assigned_worker_id'>,
): boolean => {
  if (['taken', 'in_progress', 'pending_bidding', 'counter_offered'].includes(job.status)) return true;
  return job.status === 'open' && !!job.assigned_worker_id;
};

/** Servicio cerrado — solo finalizados o cancelados. */
export const isClientOrderHistory = (job: Pick<ClientOrderJob, 'status'>): boolean =>
  ['completed', 'cancelled', 'cancelled_by_client_pending'].includes(job.status);

export const CLIENT_PENDING_STATUSES = new Set<JobStatus>(['open']);
export const CLIENT_ACTIVE_STATUSES = new Set<JobStatus>(['taken', 'in_progress', 'pending_bidding', 'counter_offered']);
export const CLIENT_HISTORY_STATUSES = new Set<JobStatus>(['completed', 'cancelled', 'cancelled_by_client_pending' as JobStatus]);
