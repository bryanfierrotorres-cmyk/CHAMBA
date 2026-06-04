import { useMemo } from 'react';
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
  const { data: assignments = [], isLoading } = useMyJobs();

  const activeCount = useMemo(
    () => countWorkerActiveCommitments(assignments),
    [assignments],
  );
  const atLimit = useMemo(
    () => workerAtCommitmentLimit(assignments),
    [assignments],
  );

  return {
    activeCount,
    maxAllowed: MAX_WORKER_ACTIVE_COMMITMENTS,
    atLimit,
    message: workerCommitmentLimitMessage(),
    isLoading: !!profile?.id && profile.role === 'worker' && isLoading,
  };
}
