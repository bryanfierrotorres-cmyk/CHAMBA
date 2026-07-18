import React, { useCallback } from 'react';
import { useMyJobs } from '@features/jobs/hooks/useJobs';
import { useWorkerWallet } from '@features/jobs/hooks/useWorkerWallet';
import { computeWorkerWalletSummary } from '@utils/workerWalletSummary';

export const useWorkerJobs = () => {
  const { data: myJobs = [], isLoading: isLoadingJobs, refetch: refetchJobs } = useMyJobs();
  const { data: walletEarnings = [], refetch: refetchWallet } = useWorkerWallet();

  const walletSummary = computeWorkerWalletSummary(walletEarnings);

  const refreshJobs = useCallback(async () => {
    await Promise.all([
      refetchJobs(),
      refetchWallet(),
    ]);
  }, [refetchJobs, refetchWallet]);

  return {
    myJobs,
    isLoadingJobs,
    walletEarnings,
    walletSummary,
    refreshJobs,
  };
};
