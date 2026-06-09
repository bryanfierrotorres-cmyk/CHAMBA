import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchJobWorkerApplications,
  subscribeToJobWorkerApplications,
} from '@features/client/services/clientJobSelectionService';
import type { JobWorkerApplication } from '@/types';

export const jobApplicationsQueryKey = (jobId: string, clientId: string) =>
  ['job-applications', jobId, clientId] as const;

const OPEN_JOB_POLL_MS = 4_000;

/**
 * Postulaciones de técnicos para una solicitud — Realtime + polling mientras está open.
 */
export function useJobWorkerApplications(
  jobId: string,
  clientId: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const active = enabled && !!jobId && !!clientId;

  const query = useQuery<JobWorkerApplication[]>({
    queryKey: jobApplicationsQueryKey(jobId, clientId),
    queryFn: () => fetchJobWorkerApplications(jobId, clientId),
    enabled: active,
    staleTime: 0,
    refetchInterval: active ? OPEN_JOB_POLL_MS : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!active) return undefined;

    return subscribeToJobWorkerApplications(jobId, () => {
      void queryClient.invalidateQueries({
        queryKey: jobApplicationsQueryKey(jobId, clientId),
      });
      void queryClient.refetchQueries({
        queryKey: jobApplicationsQueryKey(jobId, clientId),
        type: 'active',
      });
    });
  }, [active, clientId, jobId, queryClient]);

  return query;
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
