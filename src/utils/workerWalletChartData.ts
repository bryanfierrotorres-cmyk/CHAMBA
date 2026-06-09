import type { WorkerWalletEarning } from '@features/jobs/services/workerWalletService';

export type WalletChartPeriod = 'day' | 'week' | 'month';

export interface WalletChartSeries {
  labels: string[];
  values: number[];
  hasRealData: boolean;
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('es-VE', { weekday: 'short' });
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('es-VE', { month: 'short' });
}

export function resolveEarningDate(earning: WorkerWalletEarning): Date | null {
  const raw = earning.completedAt ?? earning.jobUpdatedAt ?? earning.assignedAt;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildLast7DayBuckets(now: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(new Date(now.getTime() - (6 - index) * DAY_MS));
    return { date, total: 0 };
  });
}

function accumulateIntoDayBuckets(
  earnings: WorkerWalletEarning[],
  buckets: { date: Date; total: number }[],
) {
  for (const earning of earnings) {
    const earnedAt = resolveEarningDate(earning);
    if (!earnedAt) continue;
    const payout = earning.workerPayout;
    if (payout <= 0) continue;

    const bucket = buckets.find(
      (entry) => startOfDay(earnedAt).getTime() === entry.date.getTime(),
    );
    if (bucket) bucket.total += payout;
  }
}

export function buildWorkerWalletChartSeries(
  earnings: WorkerWalletEarning[],
  period: WalletChartPeriod,
): WalletChartSeries {
  const now = new Date();

  if (period === 'day') {
    const buckets = buildLast7DayBuckets(now);
    accumulateIntoDayBuckets(earnings, buckets);
    const hasRealData = buckets.some((entry) => entry.total > 0);
    return {
      labels: buckets.map((entry) => formatDateLabel(entry.date)),
      values: buckets.map((entry) => entry.total),
      hasRealData,
    };
  }

  if (period === 'week') {
    const buckets = buildLast7DayBuckets(now);
    accumulateIntoDayBuckets(earnings, buckets);
    const hasRealData = buckets.some((entry) => entry.total > 0);
    return {
      labels: buckets.map((entry) => formatDayLabel(entry.date)),
      values: buckets.map((entry) => entry.total),
      hasRealData,
    };
  }

  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (5 - index), 1));
    return { date, total: 0 };
  });

  for (const earning of earnings) {
    const earnedAt = resolveEarningDate(earning);
    if (!earnedAt) continue;
    const payout = earning.workerPayout;
    if (payout <= 0) continue;

    const monthStart = startOfMonth(earnedAt).getTime();
    const bucket = buckets.find(
      (entry) => startOfMonth(entry.date).getTime() === monthStart,
    );
    if (bucket) bucket.total += payout;
  }

  const hasRealData = buckets.some((entry) => entry.total > 0);
  return {
    labels: buckets.map((entry) => formatMonthLabel(entry.date)),
    values: buckets.map((entry) => entry.total),
    hasRealData,
  };
}

export function buildWorkerWalletTransactions(
  earnings: WorkerWalletEarning[],
): WorkerWalletEarning[] {
  return earnings
    .filter((e) => e.workerPayout > 0)
    .slice()
    .sort((a, b) => {
      const aTime = resolveEarningDate(a)?.getTime() ?? 0;
      const bTime = resolveEarningDate(b)?.getTime() ?? 0;
      return bTime - aTime;
    });
}
