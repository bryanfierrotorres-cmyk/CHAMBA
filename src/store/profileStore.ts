import { create } from 'zustand';
import type { WorkerProfile, AvailabilityStatus } from '@/types';
import {
  fetchWorkerProfile,
  setAvailabilityStatus,
  updateWorkerProfile,
  fetchWorkerStats,
  subscribeToWorkerProfile,
  type WorkerProfileUpdates,
  type WorkerStats,
} from '@features/workers/services/profileService';

// ─── State shape ─────────────────────────────────────────────────

interface ProfileState {
  workerProfile:    WorkerProfile | null;
  stats:            WorkerStats | null;
  isLoadingProfile: boolean;
  isTogglingAvail:  boolean;   // spinner solo en el availability switch
  profileError:     string | null;

  // Actions
  loadProfile:         (workerId: string) => Promise<void>;
  loadStats:           (workerId: string) => Promise<void>;
  setAvailability:     (workerId: string, status: AvailabilityStatus) => Promise<void>;
  updateProfile:       (workerId: string, updates: WorkerProfileUpdates) => Promise<void>;
  setWorkerProfile:    (profile: WorkerProfile) => void;  // para realtime
  resetProfileStore:   () => void;
}

// ─── Store ───────────────────────────────────────────────────────

export const useProfileStore = create<ProfileState>((set, get) => ({
  workerProfile:    null,
  stats:            null,
  isLoadingProfile: false,
  isTogglingAvail:  false,
  profileError:     null,

  // ── loadProfile ──────────────────────────────────────────────
  loadProfile: async (workerId) => {
    set({ isLoadingProfile: true, profileError: null });
    try {
      const profile = await fetchWorkerProfile(workerId);
      set({ workerProfile: profile });
    } catch (err: any) {
      set({ profileError: err.message });
    } finally {
      set({ isLoadingProfile: false });
    }
  },

  // ── loadStats ────────────────────────────────────────────────
  loadStats: async (workerId) => {
    try {
      const stats = await fetchWorkerStats(workerId);
      set({ stats });
    } catch {
      // stats son opcionales, silenciar error
    }
  },

  // ── setAvailability (actualización optimista) ────────────────
  setAvailability: async (workerId, status) => {
    const previous = get().workerProfile;

    // 1. Actualizar UI inmediatamente (optimistic update)
    if (previous) {
      set({ workerProfile: { ...previous, availability_status: status } });
    }

    set({ isTogglingAvail: true });

    try {
      // 2. Confirmar con Supabase
      const updated = await setAvailabilityStatus(workerId, status);
      set({ workerProfile: updated });
    } catch (err: any) {
      // 3. Revertir si falla
      if (previous) set({ workerProfile: previous });
      set({ profileError: err.message });
      throw err;
    } finally {
      set({ isTogglingAvail: false });
    }
  },

  // ── updateProfile ─────────────────────────────────────────────
  updateProfile: async (workerId, updates) => {
    set({ isLoadingProfile: true });
    try {
      const updated = await updateWorkerProfile(workerId, updates);
      set({ workerProfile: updated });
    } catch (err: any) {
      set({ profileError: err.message });
      throw err;
    } finally {
      set({ isLoadingProfile: false });
    }
  },

  // ── setWorkerProfile (handler para realtime) ─────────────────
  setWorkerProfile: (profile) => set({ workerProfile: profile }),

  // ── reset ─────────────────────────────────────────────────────
  resetProfileStore: () =>
    set({
      workerProfile:    null,
      stats:            null,
      isLoadingProfile: false,
      isTogglingAvail:  false,
      profileError:     null,
    }),
}));

// ─── Selectors ──────────────────────────────────────────────────

export const selectAvailability = (s: ProfileState) =>
  s.workerProfile?.availability_status ?? 'offline';

export const selectIsAvailable = (s: ProfileState) =>
  s.workerProfile?.availability_status === 'available';
