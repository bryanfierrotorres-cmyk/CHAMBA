import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import { syncProfileWithDatabase } from '@utils/profileSync';
import { JOB_KEYS } from '@features/jobs/hooks/useJobs';
import { workerActiveCountKey } from '@features/jobs/hooks/useJobActiveLimits';

const refreshWorkerAgenda = (
  queryClient: ReturnType<typeof useQueryClient>,
  workerId: string,
): void => {
  const key = JOB_KEYS.myJobs(workerId);
  void queryClient.invalidateQueries({ queryKey: key });
  void queryClient.refetchQueries({ queryKey: key, type: 'all' });
  void queryClient.invalidateQueries({ queryKey: workerActiveCountKey(workerId) });
};

/**
 * Realtime sobre asignaciones y jobs del técnico (aprobación cliente, fases).
 * Montar en WorkerNavigator para cubrir Radar + Mis Chambas.
 */
export function useWorkerAssignmentsRealtime(): void {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile?.id || profile.role !== 'worker') {
      return undefined;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const synced = await syncProfileWithDatabase(profile);
      if (cancelled) return;

      const workerId = synced.id;

      if (synced.id !== profile.id || synced.is_approved !== profile.is_approved) {
        useAuthStore.getState().setProfile(synced);
      }

      channel = supabase
        .channel(`worker-assignments-${workerId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'job_assignments',
            filter: `worker_id=eq.${workerId}`,
          },
          () => {
            refreshWorkerAgenda(queryClient, workerId);
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: `assigned_worker_id=eq.${workerId}`,
          },
          (payload) => {
            const jobId = (payload.new as { id?: string })?.id;
            if (jobId) {
              void queryClient.invalidateQueries({ queryKey: JOB_KEYS.detail(jobId) });
            }
            refreshWorkerAgenda(queryClient, workerId);
          },
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[WorkerRealtime] asignaciones:', err?.message ?? status);
          }
        });

    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role, queryClient, session?.access_token]);
}
