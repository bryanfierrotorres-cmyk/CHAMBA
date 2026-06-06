import type { JobAssignment } from '@/types';

export interface WorkerWalletSummary {
  /** Pagos acreditados (payment_status = paid). */
  totalPaid: number;
  /** Completadas, pago aún no acreditado. */
  pendingPayout: number;
  /** En proceso de transferencia. */
  processingPayout: number;
  /** Chambas en curso (estimado a cobrar). */
  inProgressEstimate: number;
  completedCount: number;
  paidCount: number;
}

export function computeWorkerWalletSummary(
  assignments: JobAssignment[],
): WorkerWalletSummary {
  let totalPaid = 0;
  let pendingPayout = 0;
  let processingPayout = 0;
  let inProgressEstimate = 0;
  let completedCount = 0;
  let paidCount = 0;

  for (const assignment of assignments) {
    const payout = assignment.job?.worker_payout ?? 0;
    const status = assignment.job?.status;

    if (status === 'completed') {
      completedCount += 1;
      if (assignment.payment_status === 'paid') {
        totalPaid += payout;
        paidCount += 1;
      } else if (assignment.payment_status === 'processing') {
        processingPayout += payout;
      } else if (assignment.payment_status !== 'failed') {
        pendingPayout += payout;
      }
    } else if (status === 'taken' || status === 'in_progress') {
      inProgressEstimate += payout;
    }
  }

  return {
    totalPaid,
    pendingPayout,
    processingPayout,
    inProgressEstimate,
    completedCount,
    paidCount,
  };
}
