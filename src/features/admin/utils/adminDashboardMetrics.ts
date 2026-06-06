import type { AdminJob } from '../services/adminService';

export const RADAR_ALERT_HOURS = 8;

export interface DashboardKpis {
  monthlyRevenue: number;
  completedThisMonth: number;
  cancelledThisMonth: number;
  topServices: Array<{ category: string; count: number }>;
}

const isInCurrentMonth = (iso: string | null | undefined): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

export const computeDashboardKpis = (jobs: AdminJob[]): DashboardKpis => {
  const completedThisMonth = jobs.filter(
    (j) => j.status === 'completed' && isInCurrentMonth(j.updated_at ?? j.created_at),
  );
  const cancelledThisMonth = jobs.filter(
    (j) => j.status === 'cancelled' && isInCurrentMonth(j.updated_at ?? j.created_at),
  );

  const monthlyRevenue = completedThisMonth.reduce(
    (sum, j) => sum + (j.pay_amount ?? 0),
    0,
  );

  const categoryCounts = new Map<string, number>();
  for (const job of jobs) {
    if (!isInCurrentMonth(job.created_at)) continue;
    const slug = (job.category ?? 'otro').toLowerCase();
    categoryCounts.set(slug, (categoryCounts.get(slug) ?? 0) + 1);
  }

  const topServices = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));

  return {
    monthlyRevenue,
    completedThisMonth: completedThisMonth.length,
    cancelledThisMonth: cancelledThisMonth.length,
    topServices,
  };
};

export const getRadarJobs = (jobs: AdminJob[]): AdminJob[] =>
  jobs.filter((j) => j.status === 'taken' || j.status === 'in_progress');

export const getJobElapsedHours = (job: AdminJob): number => {
  const anchor =
    job.updated_at
    ?? job.assignments?.[0]?.assigned_at
    ?? job.created_at;
  const ms = Date.now() - new Date(anchor).getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
};

export const isRadarAlert = (job: AdminJob): boolean =>
  getJobElapsedHours(job) >= RADAR_ALERT_HOURS;
