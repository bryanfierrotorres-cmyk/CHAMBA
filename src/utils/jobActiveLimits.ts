import {
  MAX_CLIENT_ACTIVE_JOBS,
  MAX_WORKER_ACTIVE_COMMITMENTS,
  CLIENT_ACTIVE_JOBS_LIMIT_MESSAGE,
  WORKER_ACTIVE_COMMITMENTS_LIMIT_MESSAGE,
} from '@constants/jobLimits';
import { JOB_STATUS, SELECTION_STATUS, OPERATIONAL_PHASE } from '@constants/jobWorkflowStatus';
import type { JobAssignment, JobStatus } from '@/types';

const TERMINAL_STATUSES = new Set<JobStatus>([
  JOB_STATUS.COMPLETED,
  JOB_STATUS.CANCELLED,
]);

export const isNonTerminalJobStatus = (status: JobStatus): boolean =>
  !TERMINAL_STATUSES.has(status);

export const countClientActiveJobs = (
  jobs: Array<{ status: JobStatus }>,
): number => jobs.filter((j) => isNonTerminalJobStatus(j.status)).length;

export const clientAtPublishLimit = (jobs: Array<{ status: JobStatus }>): boolean =>
  countClientActiveJobs(jobs) >= MAX_CLIENT_ACTIVE_JOBS;

type AssignmentRow = JobAssignment & { selection_status?: string | null };

/**
 * Cuenta chambas no finalizadas del técnico: postulación pendiente (open) o trabajo asignado/en curso.
 */
/** Postulación enviada — el cliente aún no eligió técnico. */
export const isWorkerPendingClientSelection = (row: AssignmentRow): boolean => {
  const job = row.job;
  if (job?.status !== JOB_STATUS.OPEN) return false;
  const selection = row.selection_status;
  if (selection === SELECTION_STATUS.REJECTED) return false;
  return !selection || selection === SELECTION_STATUS.PENDING;
};

/**
 * Cupo activo alineado con count_worker_active_commitments (048):
 * open+pending, taken/in_progress+approved solo si assigned_worker_id = técnico.
 */
export const isWorkerCommitmentActive = (row: AssignmentRow): boolean => {
  const job = row.job;
  if (!job?.id) return false;

  const status = job.status as JobStatus;
  if (status === JOB_STATUS.COMPLETED || status === JOB_STATUS.CANCELLED) return false;

  const selection = row.selection_status;
  if (selection === SELECTION_STATUS.REJECTED) return false;

  const isAssignedToWorker =
    job.assigned_worker_id != null && job.assigned_worker_id === row.worker_id;

  if (status === JOB_STATUS.OPEN) {
    return selection === SELECTION_STATUS.PENDING
      && (job.assigned_worker_id == null || isAssignedToWorker);
  }

  if (status === JOB_STATUS.IN_PROGRESS) {
    return isAssignedToWorker
      && (selection === SELECTION_STATUS.APPROVED || selection == null);
  }

  if (status === JOB_STATUS.TAKEN) {
    return isAssignedToWorker
      && selection === SELECTION_STATUS.APPROVED
      && job.operational_phase !== OPERATIONAL_PHASE.COMPLETED;
  }

  return false;
};

export const countWorkerActiveCommitments = (assignments: AssignmentRow[]): number => {
  const seen = new Set<string>();
  let count = 0;

  for (const row of assignments) {
    if (!isWorkerCommitmentActive(row)) continue;

    const jobId = row.job?.id;
    if (!jobId || seen.has(jobId)) continue;
    seen.add(jobId);
    count += 1;
  }

  return count;
};

export const workerAtCommitmentLimit = (assignments: AssignmentRow[]): boolean =>
  countWorkerActiveCommitments(assignments) >= MAX_WORKER_ACTIVE_COMMITMENTS;

export const clientPublishLimitMessage = (): string => CLIENT_ACTIVE_JOBS_LIMIT_MESSAGE;

export const workerCommitmentLimitMessage = (): string =>
  WORKER_ACTIVE_COMMITMENTS_LIMIT_MESSAGE;
