import { create } from 'zustand';
import {
  getLocalAssignments,
  getAllLocalAssignments,
  upsertLocalAssignment,
} from '@utils/localAssignments';
import { CONFIG } from '@constants/config';
import type { Job, JobAssignment } from '@/types';

interface AssignmentsState {
  items: JobAssignment[];
  isLoading: boolean;
  workerId: string | null;
  refresh: (workerId: string) => Promise<JobAssignment[]>;
  addAssignment: (
    assignment: JobAssignment,
    job?: Job | Partial<Job> | null,
  ) => Promise<void>;
  patchItem: (assignmentId: string, patch: Partial<JobAssignment>, jobPatch?: Partial<Job>) => void;
  clear: () => void;
}

export const useAssignmentsStore = create<AssignmentsState>((set, get) => ({
  items: [],
  isLoading: false,
  workerId: null,

  refresh: async (workerId) => {
    set({ isLoading: true, workerId });
    try {
      let items = await getLocalAssignments(workerId);
      if (items.length === 0 && CONFIG.pilot.enabled) {
        items = await getAllLocalAssignments();
      }
      set({ items, isLoading: false });
      return items;
    } catch {
      set({ isLoading: false });
      return get().items;
    }
  },

  addAssignment: async (assignment, job) => {
    const merged: JobAssignment = {
      ...assignment,
      job: (job ?? assignment.job) as Job | undefined,
    };
    set((state) => {
      const exists = state.items.findIndex(
        (a) => a.id === merged.id || a.job_id === merged.job_id,
      );
      const items = exists === -1
        ? [merged, ...state.items]
        : state.items.map((a, i) => (i === exists ? { ...a, ...merged } : a));
      return { items, workerId: merged.worker_id };
    });
    void upsertLocalAssignment(merged, job ?? merged.job ?? null);
  },

  patchItem: (assignmentId, patch, jobPatch) => {
    set((state) => ({
      items: state.items.map((a) => {
        if (a.id !== assignmentId) return a;
        return {
          ...a,
          ...patch,
          job: a.job && jobPatch ? { ...a.job, ...jobPatch } : a.job,
        };
      }),
    }));
  },

  clear: () => set({ items: [], workerId: null, isLoading: false }),
}));
