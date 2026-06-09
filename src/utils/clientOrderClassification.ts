import type { ClientOrderJob, JobStatus } from '@/types';

/** Solicitud publicada sin técnico elegido aún. */
export const isClientOrderPending = (
  job: Pick<ClientOrderJob, 'status' | 'assigned_worker_id'>,
): boolean =>
  job.status === 'open' && !job.assigned_worker_id;

/** Servicio en ejecución (técnico asignado o trabajo en curso). */
export const isClientOrderActive = (
  job: Pick<ClientOrderJob, 'status' | 'assigned_worker_id'>,
): boolean => {
  if (job.status === 'taken' || job.status === 'in_progress') return true;
  return job.status === 'open' && !!job.assigned_worker_id;
};

/** Servicio cerrado — solo finalizados o cancelados. */
export const isClientOrderHistory = (job: Pick<ClientOrderJob, 'status'>): boolean =>
  job.status === 'completed' || job.status === 'cancelled';

export const CLIENT_PENDING_STATUSES = new Set<JobStatus>(['open']);
export const CLIENT_ACTIVE_STATUSES = new Set<JobStatus>(['taken', 'in_progress']);
export const CLIENT_HISTORY_STATUSES = new Set<JobStatus>(['completed', 'cancelled']);
