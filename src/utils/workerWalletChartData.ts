import type { JobAssignment } from '@/types';

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

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('es-VE', { weekday: 'short' });
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('es-VE', { month: 'short' });
}

function getPaidCompletedAssignments(assignments: JobAssignment[]): JobAssignment[] {
  return assignments.filter(
    (item) =>
      item.job?.status === 'completed'
      && item.payment_status === 'paid'
      && (item.job?.worker_payout ?? 0) > 0,
  );
}

function resolvePaidAt(assignment: JobAssignment): Date | null {
  const raw = assignment.completed_at ?? assignment.job?.updated_at ?? assignment.assigned_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPlaceholderSeries(period: WalletChartPeriod): WalletChartSeries {
  if (period === 'day') {
    return {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      values: [0, 0, 0, 0, 0, 0, 0],
      hasRealData: false,
    };
  }
  if (period === 'week') {
    return {
      labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
      values: [0, 0, 0, 0],
      hasRealData: false,
    };
  }
  return {
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    values: [0, 0, 0, 0, 0, 0],
    hasRealData: false,
  };
}

export function buildWorkerWalletChartSeries(
  assignments: JobAssignment[],
  period: WalletChartPeriod,
): WalletChartSeries {
  const paid = getPaidCompletedAssignments(assignments);
  const now = new Date();

  if (period === 'day') {
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const date = startOfDay(new Date(now.getTime() - (6 - index) * DAY_MS));
      return { date, total: 0 };
    });

    for (const item of paid) {
      const paidAt = resolvePaidAt(item);
      if (!paidAt) continue;
      const payout = item.job?.worker_payout ?? 0;
      const bucket = buckets.find(
        (entry) => startOfDay(paidAt).getTime() === entry.date.getTime(),
      );
      if (bucket) bucket.total += payout;
    }

    const hasRealData = buckets.some((entry) => entry.total > 0);
    return {
      labels: buckets.map((entry) => formatDayLabel(entry.date)),
      values: buckets.map((entry) => entry.total),
      hasRealData,
    };
  }

  if (period === 'week') {
    const buckets = Array.from({ length: 4 }, (_, index) => {
      const date = startOfWeek(new Date(now.getTime() - (3 - index) * 7 * DAY_MS));
      return { date, total: 0 };
    });

    for (const item of paid) {
      const paidAt = resolvePaidAt(item);
      if (!paidAt) continue;
      const payout = item.job?.worker_payout ?? 0;
      const weekStart = startOfWeek(paidAt).getTime();
      const bucket = buckets.find(
        (entry) => startOfWeek(entry.date).getTime() === weekStart,
      );
      if (bucket) bucket.total += payout;
    }

    const hasRealData = buckets.some((entry) => entry.total > 0);
    return {
      labels: buckets.map((entry) => formatWeekLabel(entry.date)),
      values: buckets.map((entry) => entry.total),
      hasRealData,
    };
  }

  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (5 - index), 1));
    return { date, total: 0 };
  });

  for (const item of paid) {
    const paidAt = resolvePaidAt(item);
    if (!paidAt) continue;
    const payout = item.job?.worker_payout ?? 0;
    const monthStart = startOfMonth(paidAt).getTime();
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
  assignments: JobAssignment[],
): JobAssignment[] {
  return getPaidCompletedAssignments(assignments)
    .slice()
    .sort((a, b) => {
      const aTime = resolvePaidAt(a)?.getTime() ?? 0;
      const bTime = resolvePaidAt(b)?.getTime() ?? 0;
      return bTime - aTime;
    });
}

export function getWalletChartSeriesOrPlaceholder(
  assignments: JobAssignment[] | undefined,
  period: WalletChartPeriod,
): WalletChartSeries {
  const series = buildWorkerWalletChartSeries(assignments ?? [], period);
  if (series.hasRealData) return series;
  return buildPlaceholderSeries(period);
}
