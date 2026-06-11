import { create } from 'zustand';
import {
  getLocalAssignments,
  upsertLocalAssignment,
} from '@utils/localAssignments';
import type { Job, JobAssignment } from '@/types';
import { isTerminalStatus } from '@constants/jobWorkflowStatus';

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
      const items = await getLocalAssignments(workerId);
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
        : state.items.map((a, i) => {
            if (i !== exists) return a;
            // Punto 4: Si el estado actual es terminal (completado/cancelado), 
            // no permitimos que una actualización lo "reviva" a un estado activo.
            const currentStatus = a.job?.status;
            const incomingStatus = merged.job?.status;
            if (
              currentStatus
              && isTerminalStatus(currentStatus)
              && incomingStatus
              && !isTerminalStatus(incomingStatus)
            ) {
              return a;
            }
            return { ...a, ...merged };
          });
      return { items, workerId: merged.worker_id };
    });
    void upsertLocalAssignment(merged, job ?? merged.job ?? null);
  },

  patchItem: (assignmentId, patch, jobPatch) => {
    set((state) => ({
      items: state.items.map((a) => {
        if (a.id !== assignmentId) return a;

        const currentStatus = a.job?.status;
        const incomingStatus = jobPatch?.status ?? patch.job?.status;
        if (
          currentStatus
          && isTerminalStatus(currentStatus)
          && incomingStatus
          && !isTerminalStatus(incomingStatus)
        ) {
          return a;
        }

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
