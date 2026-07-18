import type { ClientOrderJob, JobStatus } from '@/types';

const HISTORY_STATUSES = new Set<string>(['completed', 'cancelled', 'cancelled_by_client_pending']);
const PENDING_BIDDING_STATUSES = new Set<string>(['pending_bidding', 'counter_offered']);

/** Solicitud publicada sin técnico elegido aún.
 *  pending_bidding y counter_offered son SIEMPRE pendientes,
 *  independientemente de assigned_worker_id (puede quedar un valor residual en DB). */
export const isClientOrderPending = (
  job: Pick<ClientOrderJob, 'status' | 'assigned_worker_id'>,
): boolean => {
  if (PENDING_BIDDING_STATUSES.has(job.status)) return true;
  if (job.status === 'open') return !job.assigned_worker_id;
  return false;
};

/** Servicio cerrado — solo finalizados o cancelados. */
export const isClientOrderHistory = (job: Pick<ClientOrderJob, 'status'>): boolean =>
  HISTORY_STATUSES.has(job.status);

/**
 * Servicio en ejecución: técnico seleccionado y servicio en curso.
 * Incluye todos los estados intermedios entre aprobación y completado,
 * sin importar la fase operativa (accepted, en_route, arrived, etc.).
 * El trabajo NO desaparece del panel hasta que sea completed o cancelled.
 */
export const isClientOrderActive = (
  job: Pick<ClientOrderJob, 'status' | 'assigned_worker_id'>,
): boolean => {
  if (isClientOrderHistory(job)) return false;
  if (isClientOrderPending(job)) return false;
  // Cualquier estado no-pending y no-historial es activo
  // Cubre: taken, in_progress, assigned, arrived, pending (legacy con worker asignado)
  return true;
};

export const CLIENT_PENDING_STATUSES = new Set<JobStatus>(['open', 'pending_bidding', 'counter_offered']);
export const CLIENT_ACTIVE_STATUSES = new Set<JobStatus>(['taken', 'in_progress', 'assigned', 'arrived']);
export const CLIENT_HISTORY_STATUSES = new Set<JobStatus>(['completed', 'cancelled', 'cancelled_by_client_pending' as JobStatus]);
