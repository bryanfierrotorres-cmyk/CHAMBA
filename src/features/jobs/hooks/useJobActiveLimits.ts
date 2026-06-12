import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import { useClientOrders } from '@features/client/hooks/useClientOrders';
import { useMyJobs } from '@features/jobs/hooks/useJobs';
import { useAuthStore } from '@store/authStore';
import {
  MAX_CLIENT_ACTIVE_JOBS,
  MAX_WORKER_ACTIVE_COMMITMENTS,
} from '@constants/jobLimits';
import {
  clientAtPublishLimit,
  countClientActiveJobs,
  countWorkerActiveCommitments,
  clientPublishLimitMessage,
  workerAtCommitmentLimit,
  workerCommitmentLimitMessage,
} from '@utils/jobActiveLimits';

const workerActiveCountKey = (workerId: string) =>
  ['worker-active-commitment-count', workerId] as const;

const fetchWorkerActiveCount = async (workerId: string): Promise<number> => {
  const { data, error } = await supabase.rpc('count_worker_active_commitments', {
    p_worker_id: workerId,
  });

  if (!error && typeof data === 'number' && Number.isFinite(data)) {
    return data;
  }

  const n = Number(data);
  if (!error && Number.isFinite(n)) {
    return n;
  }

  return -1;
};

export function useClientPublishLimit() {
  const profile = useAuthStore((s) => s.profile);
  const { data: orders = [], isLoading } = useClientOrders();

  const activeCount = useMemo(() => countClientActiveJobs(orders), [orders]);
  const atLimit = useMemo(() => clientAtPublishLimit(orders), [orders]);

  return {
    activeCount,
    maxAllowed: MAX_CLIENT_ACTIVE_JOBS,
    atLimit,
    message: clientPublishLimitMessage(),
    isLoading: !!profile?.id && profile.role === 'client' && isLoading,
  };
}

export function useWorkerCommitmentLimit() {
  const profile = useAuthStore((s) => s.profile);
  const workerId = profile?.id ?? '';
  const { data: assignments = [], isLoading: assignmentsLoading, refetch } = useMyJobs();

  const localCount = useMemo(
    () => countWorkerActiveCommitments(assignments),
    [assignments],
  );

  const countQuery = useQuery({
    queryKey: workerActiveCountKey(workerId),
    queryFn: () => fetchWorkerActiveCount(workerId),
    enabled: !!workerId && profile?.role === 'worker',
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const remoteCount = countQuery.data;
  const activeCount =
    remoteCount != null && remoteCount >= 0 ? remoteCount : localCount;

  const atLimit = activeCount >= MAX_WORKER_ACTIVE_COMMITMENTS;

  const refreshLimit = async () => {
    await Promise.all([countQuery.refetch(), refetch()]);
  };

  return {
    activeCount,
    maxAllowed: MAX_WORKER_ACTIVE_COMMITMENTS,
    atLimit,
    message: workerCommitmentLimitMessage(),
    isLoading:
      !!workerId
      && profile?.role === 'worker'
      && (assignmentsLoading || countQuery.isLoading),
    refetch: refreshLimit,
  };
}

export { workerActiveCountKey };
