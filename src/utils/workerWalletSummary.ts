import type { WorkerWalletEarning } from '@features/jobs/services/workerWalletService';

export interface WorkerWalletSummary {
  /** Suma de worker_payout en trabajos completados. */
  totalAvailable: number;
  /** Completadas con pago pendiente de acreditar. */
  pendingPayout: number;
  /** En proceso de transferencia. */
  processingPayout: number;
  /** Ya transferido al técnico (payment_status = paid). */
  paidOut: number;
  completedCount: number;
}

export function computeWorkerWalletSummary(
  earnings: WorkerWalletEarning[],
): WorkerWalletSummary {
  let totalAvailable = 0;
  let pendingPayout = 0;
  let processingPayout = 0;
  let paidOut = 0;

  for (const earning of earnings) {
    const payout = earning.workerPayout;
    if (payout <= 0) continue;

    totalAvailable += payout;

    if (earning.paymentStatus === 'paid') {
      paidOut += payout;
    } else if (earning.paymentStatus === 'processing') {
      processingPayout += payout;
    } else if (earning.paymentStatus !== 'failed') {
      pendingPayout += payout;
    }
  }

  return {
    totalAvailable,
    pendingPayout,
    processingPayout,
    paidOut,
    completedCount: earnings.filter((e) => e.workerPayout > 0).length,
  };
}
