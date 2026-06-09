import { useQuery, type QueryClient } from '@tanstack/react-query';
import { fetchClientOrders } from '@features/jobs/services/jobsService';
import { useAuthStore } from '@store/authStore';
import { QUERY_STALE_FEED_MS } from '@constants/queryCache';
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
};

/** Actualiza la lista en caché sin esperar refetch (Realtime / polling). */
export const patchClientOrderRowInCache = (
  queryClient: QueryClient,
  clientId: string,
  row: JobStatusPatch,
): void => {
  if (!clientId || !row.id || !row.status) return;

  queryClient.setQueryData<ClientOrderJob[]>(clientOrdersQueryKey(clientId), (old) => {
    if (!old?.length) return old;
    const idx = old.findIndex((j) => j.id === row.id);
    if (idx < 0) return old;

    const prev = old[idx];
    const phase = (row.operational_phase ?? prev.operational_phase) as WorkerOperationalPhase | null;
    const next = [...old];
    next[idx] = {
      ...prev,
      status: row.status,
      operational_phase: phase,
      title: row.title?.trim() ? row.title.trim() : prev.title,
      updated_at: new Date().toISOString(),
    };
    return next;
  });
};

export function useClientOrders() {
  const clientId = useAuthStore((s) => s.profile?.id);
  const clientRole = useAuthStore((s) => s.profile?.role);

  return useQuery<ClientOrderJob[]>({
    queryKey: clientOrdersQueryKey(clientId ?? ''),
    queryFn: () => fetchClientOrders(clientId!),
    enabled: !!clientId && clientRole === 'client',
    staleTime: QUERY_STALE_FEED_MS,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      clientOrdersNeedLivePoll(query.state.data) ? 5_000 : false,
    refetchIntervalInBackground: true,
  });
}
