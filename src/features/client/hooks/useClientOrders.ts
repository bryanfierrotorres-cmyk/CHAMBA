import { useQuery, type QueryClient } from '@tanstack/react-query';
import { fetchClientOrders } from '@features/jobs/services/jobsService';
import { useAuthStore } from '@store/authStore';
import { QUERY_STALE_FEED_MS } from '@constants/queryCache';
import { CLIENT_APPROVED_JOB_STATE } from '@constants/jobWorkflowStatus';
import { JOB_KEYS } from '@features/jobs/hooks/useJobs';
import { workerActiveCountKey } from '@features/jobs/hooks/useJobActiveLimits';
import type { ClientOrderJob, JobStatus, WorkerOperationalPhase } from '@/types';

export const clientOrdersQueryKey = (clientId: string) => ['client-orders', clientId] as const;

const ACTIVE_CLIENT_STATUSES = new Set<JobStatus>(['open', 'taken', 'in_progress']);

/** True si hay solicitudes que pueden cambiar (postulaciones, fases, etc.). */
export const clientOrdersNeedLivePoll = (jobs: ClientOrderJob[] | undefined): boolean =>
  !!jobs?.some((j) => ACTIVE_CLIENT_STATUSES.has(j.status));

type JobStatusPatch = {
  id: string;
  status?: JobStatus;
  operational_phase?: string | null;
  title?: string;
  pay_amount?: number;
  worker_payout?: number;
  platform_fee?: number;
  created_at?: string;
  updated_at?: string;
};

/** Actualiza la lista en caché sin esperar refetch (Realtime / polling / impulso). */
export const patchClientOrderRowInCache = (
  queryClient: QueryClient,
  clientId: string,
  row: JobStatusPatch,
): void => {
  if (!clientId || !row.id) return;

  queryClient.setQueryData<ClientOrderJob[]>(clientOrdersQueryKey(clientId), (old: ClientOrderJob[] | undefined) => {
    if (!old?.length) return old;
    const idx = old.findIndex((j: ClientOrderJob) => j.id === row.id);
    if (idx < 0) return old;

    const prev = old[idx];
    const phase = (row.operational_phase ?? prev.operational_phase) as WorkerOperationalPhase | null;
    const next = [...old];
    next[idx] = {
      ...prev,
      ...(row.status ? { status: row.status } : {}),
      operational_phase: phase,
      title: row.title?.trim() ? row.title.trim() : prev.title,
      pay_amount: row.pay_amount ?? prev.pay_amount,
      worker_payout: row.worker_payout ?? prev.worker_payout,
      platform_fee: row.platform_fee ?? prev.platform_fee,
      created_at: row.created_at ?? prev.created_at,
      updated_at: row.updated_at ?? new Date().toISOString(),
    };
    return next;
  });
};

/** Tras aprobar técnico: alinear caché cliente + invalidar agenda del worker. */
export const patchClientOrderAfterWorkerApproval = (
  queryClient: QueryClient,
  clientId: string,
  jobId: string,
  workerId: string,
): void => {
  patchClientOrderRowInCache(queryClient, clientId, {
    id: jobId,
    status: CLIENT_APPROVED_JOB_STATE.jobStatus,
    operational_phase: CLIENT_APPROVED_JOB_STATE.operationalPhase,
    updated_at: new Date().toISOString(),
  });
  void queryClient.invalidateQueries({ queryKey: JOB_KEYS.myJobs(workerId) });
  void queryClient.invalidateQueries({ queryKey: workerActiveCountKey(workerId) });
  void queryClient.invalidateQueries({ queryKey: ['jobs', 'my'] });
};

export function useClientOrders() {
  const clientId = useAuthStore((s) => s.profile?.id);
  const clientRole = useAuthStore((s) => s.profile?.role);

  return useQuery<ClientOrderJob[]>({
    queryKey: clientOrdersQueryKey(clientId ?? ''),
    queryFn: () => fetchClientOrders(clientId!),
    enabled: !!clientId && clientRole === 'client',
    placeholderData: [],
    retry: 0,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      clientOrdersNeedLivePoll(query.state.data) ? 5_000 : false,
    refetchIntervalInBackground: true,
  });
}
