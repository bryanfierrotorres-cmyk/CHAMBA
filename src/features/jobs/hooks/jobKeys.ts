import type { JobStatus, JobCategory } from '@/types';

export const JOB_KEYS = {
  all: ['jobs'] as const,
  feed: (status?: JobStatus, category?: JobCategory) =>
    ['jobs', 'feed', status, category] as const,
  detail: (id: string) => ['jobs', id] as const,
  myJobs: (workerId: string) => ['jobs', 'my', workerId] as const,
  adminAll: () => ['jobs', 'admin', 'all'] as const,
  clientOrders: (userId: string) => ['client-orders', userId] as const,
  adminControl: () => ['admin', 'control', 'jobs'] as const,
};

export const workerActiveCountKey = (workerId: string) =>
  ['worker-active-commitment-count', workerId] as const;
