import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@store/authStore';
import { fetchWorkerWalletEarnings } from '../services/workerWalletService';

export const WALLET_KEYS = {
  all: ['worker-wallet'] as const,
  earnings: (workerId: string) => [...WALLET_KEYS.all, workerId] as const,
};

export const useWorkerWallet = () => {
  const profile = useAuthStore((s) => s.profile);
  const workerId = profile?.id ?? '';

  return useQuery({
    queryKey: WALLET_KEYS.earnings(workerId),
    queryFn: () => fetchWorkerWalletEarnings(workerId),
    enabled: !!workerId && profile?.role === 'worker',
    staleTime: 30_000,
    refetchOnMount: true,
  });
};
