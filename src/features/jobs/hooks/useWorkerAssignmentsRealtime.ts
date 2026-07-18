import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import { syncProfileWithDatabase } from '@utils/profileSync';
import { JOB_KEYS } from '@features/jobs/hooks/useJobs';
import { workerActiveCountKey } from '@features/jobs/hooks/jobKeys';

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
    let fallbackInterval: NodeJS.Timeout | null = null;
    let isConnectingTimeout: NodeJS.Timeout | null = null;

    const clearFallback = () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

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
        .subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') {
            clearFallback();
            if (isConnectingTimeout) clearTimeout(isConnectingTimeout);
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('[WorkerRealtime] asignaciones:', err?.message ?? status);
            // Activar fallback
            clearFallback();
            
            fallbackInterval = setInterval(() => {
              if (!cancelled) refreshWorkerAgenda(queryClient, workerId);
            }, 5000);
          }
        });

      // Handle long connecting status
      isConnectingTimeout = setTimeout(() => {
        if (channel?.state !== 'joined' && channel?.state !== 'joining') {
          // If after 10s we are not joined, forcefully trigger fallback
          if (!fallbackInterval) {
            fallbackInterval = setInterval(() => {
              if (!cancelled) refreshWorkerAgenda(queryClient, workerId);
            }, 5000);
          }
        }
      }, 10000);

    };

    void setup();

    return () => {
      cancelled = true;
      clearFallback();
      if (isConnectingTimeout) clearTimeout(isConnectingTimeout);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role, queryClient, session?.access_token]);
}
