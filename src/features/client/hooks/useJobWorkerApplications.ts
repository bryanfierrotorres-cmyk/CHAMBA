import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJobWorkerApplications } from '@features/client/services/clientJobSelectionService';
import { QUERY_STALE_FEED_MS } from '@constants/queryCache';
import { supabase } from '@services/supabase';
import { clientOrdersQueryKey } from '@features/client/hooks/useClientOrders';
import type { ClientOrderJob, JobWorkerApplication } from '@/types';

export const jobApplicationsQueryKey = (jobId: string, clientId: string) =>
  ['job-applications', jobId, clientId] as const;

const OPEN_JOB_POLL_MS = 4_000;

/** Sufijo único por montaje — evita reutilizar un topic ya suscrito en el cliente Realtime. */
const uniqueChannelSuffix = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Statuses que aún pueden recibir nuevas postulaciones o cambios de fase. */
const LIVE_JOB_STATUSES = new Set(['open', 'pending_bidding', 'counter_offered', 'taken', 'in_progress']);

/**
 * Un canal Realtime por solicitud activa.
 * Escucha cambios en job_assignments (nuevas postulaciones) Y en jobs (fase operativa, estado).
 * Vive en la pantalla para evitar dobles suscripciones al mismo jobId.
 */
export function useClientOpenJobsApplicationsRealtime(
  jobs: ClientOrderJob[],
  profileId: string | undefined,
): void {
  const queryClient = useQueryClient();

  const liveTargets = useMemo(
    () =>
      jobs
        .filter((j) => LIVE_JOB_STATUSES.has(j.status) && j.id)
        .map((j) => ({
          jobId: j.id,
          clientId: j.created_by || profileId || '',
        }))
        .filter((t) => !!t.clientId),
    [jobs, profileId],
  );

  const targetsKey = useMemo(
    () => liveTargets.map((t) => `${t.jobId}:${t.clientId}`).sort().join('|'),
    [liveTargets],
  );

  useEffect(() => {
    if (!targetsKey) return undefined;

    const channels = liveTargets.map(({ jobId, clientId }) => {
      const appsQueryKey = jobApplicationsQueryKey(jobId, clientId);
      const ordersQueryKey = clientOrdersQueryKey(clientId);

      const refreshApplications = (): void => {
        void queryClient.invalidateQueries({ queryKey: appsQueryKey });
        void queryClient.refetchQueries({ queryKey: appsQueryKey, type: 'active' });
      };

      const refreshOrders = (): void => {
        void queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      };

      const channelName = `job-live-${jobId}-${uniqueChannelSuffix()}`;

      return supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'job_assignments',
            filter: `job_id=eq.${jobId}`,
          },
          () => refreshApplications(),
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'job_assignments',
            filter: `job_id=eq.${jobId}`,
          },
          () => refreshApplications(),
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: `id=eq.${jobId}`,
          },
          () => refreshOrders(),
        )
        .subscribe((status, err) => {
          if (__DEV__ && (status === 'CHANNEL_ERROR' || err)) {
            console.warn('[JobLiveRealtime]', jobId, err?.message ?? status);
          }
        });
    });

    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [targetsKey, liveTargets, queryClient]);
}

/**
 * Postulaciones de técnicos para una solicitud — consulta + polling (Realtime en pantalla).
 */
export function useJobWorkerApplications(
  jobId: string,
  clientId: string,
  enabled: boolean,
) {
  const active = enabled && !!jobId && !!clientId;

  return useQuery<JobWorkerApplication[]>({
    queryKey: jobApplicationsQueryKey(jobId, clientId),
    queryFn: () => fetchJobWorkerApplications(jobId, clientId),
    enabled: active,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: active ? 3_000 : false,
    refetchIntervalInBackground: false,
  });
}

export const invalidateJobApplications = (
  queryClient: ReturnType<typeof useQueryClient>,
  jobId: string,
): void => {
  void queryClient.invalidateQueries({
    predicate: (q) =>
      q.queryKey[0] === 'job-applications' && q.queryKey[1] === jobId,
  });
};
