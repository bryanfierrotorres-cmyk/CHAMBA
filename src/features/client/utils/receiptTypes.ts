export interface ReceiptData {
  jobId: string;
  jobTitle: string;
  categoryLabel: string;
  payAmountLabel: string;
  completedAt: string;
  workerName?: string | null;
  clientName?: string | null;
  address?: string | null;
}
