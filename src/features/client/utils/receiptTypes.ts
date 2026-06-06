export interface ReceiptData {
  jobId: string;
  jobTitle: string;
  categoryLabel: string;
  payAmountLabel: string;
  completedAt: string;
  completedDateLabel?: string;
  durationHours?: number;
  workerName?: string | null;
  clientName?: string | null;
  address?: string | null;
}

export const buildReceiptInvoiceNumber = (jobId: string): string => {
  const compact = jobId.replace(/-/g, '').slice(0, 12).toUpperCase();
  return `NI${compact}`;
};
