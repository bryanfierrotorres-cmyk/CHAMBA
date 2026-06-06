import { coerceNumber } from '@utils/formatters';
import type { JobWorkerApplication } from '@/types';

export interface WorkerTrustSummary {
  isNew: boolean;
  starLabel: string | null;
  jobsLabel: string | null;
}

export const summarizeWorkerTrust = (app: JobWorkerApplication): WorkerTrustSummary => {
  const rating = coerceNumber(app.rating_avg, 0);
  const reviews = app.total_reviews ?? 0;
  const jobsDone = app.total_jobs_done ?? 0;
  const hasRating = rating > 0 && reviews > 0;
  const hasJobs = jobsDone > 0;
  const isNew = !hasRating && !hasJobs;

  if (isNew) {
    return {
      isNew: true,
      starLabel: null,
      jobsLabel: 'Nuevo técnico',
    };
  }

  return {
    isNew: false,
    starLabel: hasRating ? `⭐ ${rating.toFixed(1)}` : null,
    jobsLabel: hasJobs
      ? `💼 ${jobsDone} chamb${jobsDone === 1 ? 'a' : 'as'} completada${jobsDone === 1 ? '' : 's'}`
      : null,
  };
};
