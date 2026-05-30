import { create } from 'zustand';
import type { Job, JobStatus } from '@/types';

interface JobFilter {
  category: string | null;
  status: JobStatus | null;
  maxDistanceKm: number | null;
}

interface JobState {
  jobs: Job[];
  selectedJob: Job | null;
  filters: JobFilter;
  isLoadingAccept: boolean;

  setJobs: (jobs: Job[]) => void;
  upsertJob: (job: Job) => void;
  removeJob: (jobId: string) => void;
  setSelectedJob: (job: Job | null) => void;
  setFilters: (filters: Partial<JobFilter>) => void;
  resetFilters: () => void;
  setLoadingAccept: (loading: boolean) => void;
}

const DEFAULT_FILTERS: JobFilter = {
  category: null,
  status: 'open',
  maxDistanceKm: null,
};

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  selectedJob: null,
  filters: DEFAULT_FILTERS,
  isLoadingAccept: false,

  setJobs: (jobs) => set({ jobs }),

  upsertJob: (job) =>
    set((state) => {
      const idx = state.jobs.findIndex((j) => j.id === job.id);
      if (idx === -1) return { jobs: [job, ...state.jobs] };
      const updated = [...state.jobs];
      updated[idx] = job;
      return { jobs: updated };
    }),

  removeJob: (jobId) =>
    set((state) => ({ jobs: state.jobs.filter((j) => j.id !== jobId) })),

  setSelectedJob: (selectedJob) => set({ selectedJob }),

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  setLoadingAccept: (isLoadingAccept) => set({ isLoadingAccept }),
}));
