import type { JobAssignment } from '@/types';
import { isWorkerPendingClientSelection } from '@utils/jobActiveLimits';
import { isWorkerAgendaHistory } from '@utils/workerOperationalPhase';

export type WorkerAgendaTab = 'pendientes' | 'activas' | 'historial';

/** Postulación enviada — el cliente aún no confirmó al técnico. */
export const isWorkerAgendaPending = (row: JobAssignment): boolean =>
  isWorkerPendingClientSelection(row);

/** Cliente y técnico ya acordaron; servicio en curso. */
export const isWorkerAgendaInProgress = (row: JobAssignment): boolean => {
  if (isWorkerAgendaHistory(row)) return false;
  if (isWorkerAgendaPending(row)) return false;

  const status = row.job?.status;
  if (status === 'taken' || status === 'in_progress') return true;

  return status === 'open' && row.selection_status === 'approved';
};

/** Servicios finalizados o cancelados. */
export const isWorkerAgendaCompleted = (row: JobAssignment): boolean =>
  isWorkerAgendaHistory(row);

export interface WorkerAgendaBuckets {
  pendientes: JobAssignment[];
  activas: JobAssignment[];
  historial: JobAssignment[];
}

export const splitWorkerAgendaAssignments = (
  assignments: JobAssignment[],
): WorkerAgendaBuckets => {
  const pendientes: JobAssignment[] = [];
  const activas: JobAssignment[] = [];
  const historial: JobAssignment[] = [];

  for (const item of assignments) {
    if (isWorkerAgendaCompleted(item)) {
      historial.push(item);
    } else if (isWorkerAgendaPending(item)) {
      pendientes.push(item);
    } else if (isWorkerAgendaInProgress(item)) {
      activas.push(item);
    }
  }

  return { pendientes, activas, historial };
};

export const filterWorkerAgendaByTab = (
  assignments: JobAssignment[],
  tab: WorkerAgendaTab,
): JobAssignment[] => {
  const buckets = splitWorkerAgendaAssignments(assignments);
  return buckets[tab];
};
