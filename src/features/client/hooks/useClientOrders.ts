import { useQuery, type QueryClient } from '@tanstack/react-query';
import { fetchClientOrders } from '@features/jobs/services/jobsService';
import { useAuthStore } from '@store/authStore';
import type { ClientOrderJob, JobStatus, WorkerOperationalPhase } from '@/types';

export const clientOrdersQueryKey = (clientId: string) => ['client-orders', clientId] as const;

const ACTIVE_CLIENT_STATUSES = new Set<JobStatus>(['open', 'taken', 'in_progress']);

/** True si hay solicitudes activas que pueden cambiar de fase (técnico en camino, etc.). */
export const clientOrdersNeedLivePoll = (jobs: ClientOrderJob[] | undefined): boolean =>
  !!jobs?.some(
    (j) =>
      ACTIVE_CLIENT_STATUSES.has(j.status)
      && (j.status === 'taken' || j.status === 'in_progress' || !!j.assigned_worker_id),
  );

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
  const profile = useAuthStore((s) => s.profile);

  return useQuery<ClientOrderJob[]>({
    queryKey: clientOrdersQueryKey(profile?.id ?? ''),
    queryFn: () => fetchClientOrders(profile!.id),
    enabled: !!profile?.id && profile.role === 'client',
    staleTime: 4_000,
    refetchInterval: (query) =>
      clientOrdersNeedLivePoll(query.state.data) ? 8_000 : false,
    refetchIntervalInBackground: true,
  });
}
