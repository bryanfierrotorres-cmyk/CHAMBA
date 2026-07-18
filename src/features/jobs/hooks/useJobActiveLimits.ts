import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import { ENV } from '@utils/env';
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

import { workerActiveCountKey } from './jobKeys';

const IS_DEMO = ENV.DATA_MODE === 'demo';

const fetchWorkerActiveCount = async (workerId: string): Promise<number> => {
  // Ese RPC no existe en Demo Mode. `enabled: false` no alcanza por sí solo —
  // un .refetch() explícito (como el de useFocusEffect en HomeScreen) lo ignora
  // y llamaría a la red igual, así que el corte va también aquí.
  if (IS_DEMO) return -1;

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
    // Demo Mode no tiene ese RPC — se apoya en localCount (ya calculado arriba
    // desde useMyJobs, que sí lee demoDb correctamente).
    enabled: !IS_DEMO && !!workerId && profile?.role === 'worker',
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 0,
  });

  const remoteCount = countQuery.data;
  const activeCount =
    remoteCount != null && remoteCount >= 0 ? remoteCount : localCount;

  const atLimit = activeCount >= MAX_WORKER_ACTIVE_COMMITMENTS;

  // Referencia estable — HomeScreen la pone en el deps array de un useCallback
  // dentro de useFocusEffect; si esta función se recreara en cada render,
  // ese efecto se re-dispararía en bucle en cada foco de pantalla.
  const refreshLimit = useCallback(async () => {
    await Promise.all([countQuery.refetch(), refetch()]);
  }, [countQuery.refetch, refetch]);

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


