import type { JobAssignment } from '@/types';
import {
  CLIENT_APPROVED_JOB_STATE,
  JOB_STATUS,
  SELECTION_STATUS,
} from '@constants/jobWorkflowStatus';

/** Normaliza filas RPC: taken + assigned_worker_id → selection approved. */
export const normalizeWorkerAssignmentRow = (
  row: JobAssignment,
): JobAssignment => {
  const job = row.job;
  if (!job?.id) return row;

  let selection_status = row.selection_status;
  const status = job.status;
  const isAssignedToWorker =
    job.assigned_worker_id != null && job.assigned_worker_id === row.worker_id;

  if (
    isAssignedToWorker
    && (status === JOB_STATUS.TAKEN || status === JOB_STATUS.IN_PROGRESS)
    && selection_status !== SELECTION_STATUS.REJECTED
  ) {
    selection_status = SELECTION_STATUS.APPROVED;
  }

  const operational_phase =
    job.operational_phase
    ?? (status === JOB_STATUS.TAKEN ? CLIENT_APPROVED_JOB_STATE.operationalPhase : job.operational_phase);

  return {
    ...row,
    selection_status,
    job: {
      ...job,
      operational_phase,
    },
  };
};

export const normalizeWorkerAssignmentRows = (
  rows: JobAssignment[],
): JobAssignment[] => rows.map(normalizeWorkerAssignmentRow);
