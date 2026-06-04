import {
  MAX_CLIENT_ACTIVE_JOBS,
  MAX_WORKER_ACTIVE_COMMITMENTS,
  CLIENT_ACTIVE_JOBS_LIMIT_MESSAGE,
  WORKER_ACTIVE_COMMITMENTS_LIMIT_MESSAGE,
} from '@constants/jobLimits';
import type { JobAssignment, JobStatus } from '@/types';

const TERMINAL_STATUSES = new Set<JobStatus>(['completed', 'cancelled']);

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
export const countWorkerActiveCommitments = (assignments: AssignmentRow[]): number => {
  const seen = new Set<string>();
  let count = 0;

  for (const row of assignments) {
    const job = row.job;
    if (!job?.id || !isNonTerminalJobStatus(job.status as JobStatus)) continue;

    const selection = row.selection_status;
    if (selection === 'rejected') continue;

    if (job.status === 'open') {
      if (selection && selection !== 'pending') continue;
    }

    if (seen.has(job.id)) continue;
    seen.add(job.id);
    count += 1;
  }

  return count;
};

export const workerAtCommitmentLimit = (assignments: AssignmentRow[]): boolean =>
  countWorkerActiveCommitments(assignments) >= MAX_WORKER_ACTIVE_COMMITMENTS;

export const clientPublishLimitMessage = (): string => CLIENT_ACTIVE_JOBS_LIMIT_MESSAGE;

export const workerCommitmentLimitMessage = (): string =>
  WORKER_ACTIVE_COMMITMENTS_LIMIT_MESSAGE;
