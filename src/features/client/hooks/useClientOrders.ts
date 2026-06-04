import { useQuery } from '@tanstack/react-query';
import { fetchClientOrders } from '@features/jobs/services/jobsService';
import { useAuthStore } from '@store/authStore';
import type { ClientOrderJob } from '@/types';

export const clientOrdersQueryKey = (clientId: string) => ['client-orders', clientId] as const;

export function useClientOrders() {
  const profile = useAuthStore((s) => s.profile);

  return useQuery<ClientOrderJob[]>({
    queryKey: clientOrdersQueryKey(profile?.id ?? ''),
    queryFn: () => fetchClientOrders(profile!.id),
    enabled: !!profile?.id && profile.role === 'client',
  });
}
