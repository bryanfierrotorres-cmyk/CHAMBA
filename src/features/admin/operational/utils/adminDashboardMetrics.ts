import type { AdminJob } from '../../services/adminService';

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

  // Comisión real de CHAMBA (platform_fee, ~5% calculado al crear el job) —
  // no el pago bruto al técnico, que es lo que el cliente pagó, no lo que ganamos.
  const monthlyRevenue = completedThisMonth.reduce(
    (sum, j) => sum + (j.platform_fee ?? 0),
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

/** Mismo filtro que usa computeDashboardKpis para el conteo — expuesto para el drill-down. */
export const getCompletedJobsThisMonth = (jobs: AdminJob[]): AdminJob[] =>
  jobs.filter((j) => j.status === 'completed' && isInCurrentMonth(j.updated_at ?? j.created_at));

export const getCancelledJobsThisMonth = (jobs: AdminJob[]): AdminJob[] =>
  jobs.filter((j) => j.status === 'cancelled' && isInCurrentMonth(j.updated_at ?? j.created_at));

/** Mismo filtro que computeExecutiveMetrics.pendingJobsCount (open + pending). */
export const getPendingJobs = (jobs: AdminJob[]): AdminJob[] =>
  jobs.filter((j) => j.status === 'open' || j.status === 'pending');

export const getOpenJobsForModeration = (jobs: AdminJob[]): AdminJob[] =>
  jobs
    .filter((j) => j.status === 'open')
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

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

// ─── Dashboard Ejecutivo ────────────────────────────────────────────────────
// Todo calculado sobre los mismos `jobs` que ya trae fetchAdminJobs() — cero
// queries nuevas. La única excepción (técnicos disponibles) vive aparte en
// executiveMetricsService.ts porque requiere datos de worker_profiles, no de jobs.

export interface ExecutiveMetrics {
  activeJobsCount: number;
  pendingJobsCount: number;
  criticalJobsCount: number;
  waitingClientsCount: number;
  /** null = sin datos suficientes todavía (ningún job con asignación registrada). */
  avgAcceptanceMinutes: number | null;
  avgCompletionMinutes: number | null;
}

const average = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

export const computeExecutiveMetrics = (jobs: AdminJob[]): ExecutiveMetrics => {
  const activeJobs = getRadarJobs(jobs);
  const pendingJobs = jobs.filter((j) => j.status === 'open' || j.status === 'pending');
  const criticalJobs = activeJobs.filter(isRadarAlert);
  const waitingClients = new Set(pendingJobs.map((j) => j.created_by));

  const acceptanceMinutes: number[] = [];
  const completionMinutes: number[] = [];

  for (const job of jobs) {
    const assignment = job.assignments?.[0];
    if (!assignment) continue;

    const createdMs = new Date(job.created_at).getTime();
    const assignedMs = new Date(assignment.assigned_at).getTime();
    if (Number.isFinite(createdMs) && Number.isFinite(assignedMs) && assignedMs >= createdMs) {
      acceptanceMinutes.push((assignedMs - createdMs) / 60_000);
    }

    if (assignment.completed_at) {
      const completedMs = new Date(assignment.completed_at).getTime();
      if (Number.isFinite(completedMs) && completedMs >= assignedMs) {
        completionMinutes.push((completedMs - assignedMs) / 60_000);
      }
    }
  }

  return {
    activeJobsCount: activeJobs.length,
    pendingJobsCount: pendingJobs.length,
    criticalJobsCount: criticalJobs.length,
    waitingClientsCount: waitingClients.size,
    avgAcceptanceMinutes: average(acceptanceMinutes),
    avgCompletionMinutes: average(completionMinutes),
  };
};

/** "45 min" o "2h 15min" — nunca decimales, pensado para una tarjeta de KPI. */
export const formatDurationMinutes = (minutes: number | null): string => {
  if (minutes == null) return '—';
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
};

/** "1m 54s" / "45s" / "2h 15min" — precisión de segundos para tiempos cortos (aceptación). */
export const formatDurationPrecise = (minutes: number | null): string => {
  if (minutes == null) return '—';
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  return formatDurationMinutes(minutes);
};

// ─── Comisión de hoy ────────────────────────────────────────────────────────

const isToday = (iso: string | null | undefined): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate()
    && d.getMonth() === now.getMonth()
    && d.getFullYear() === now.getFullYear()
  );
};

/** Comisión real (platform_fee) de los jobs completados hoy — mismo criterio que monthlyRevenue. */
export const computeTodayRevenue = (jobs: AdminJob[]): number =>
  jobs
    .filter((j) => j.status === 'completed' && isToday(j.updated_at ?? j.created_at))
    .reduce((sum, j) => sum + (j.platform_fee ?? 0), 0);

// ─── Alertas por umbral ─────────────────────────────────────────────────────
// Regla de oro: se evalúan sobre datos que la pantalla ya tiene en memoria —
// nada de esto crea un listener nuevo ni una suscripción global.

export type AlertSeverity = 'high' | 'medium';

export interface OperationalAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
}

const ALERT_THRESHOLDS = {
  pendingJobsHigh: 8,
  pendingJobsMedium: 4,
  avgAcceptanceMinutesHigh: 30,
  fewAvailableWorkers: 2,
  cancellationRatioHigh: 0.25, // 25% de lo completado+cancelado este mes
};

export const computeOperationalAlerts = (
  jobs: AdminJob[],
  metrics: ExecutiveMetrics,
  kpis: DashboardKpis,
  availableWorkersCount: number,
): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];

  if (metrics.pendingJobsCount >= ALERT_THRESHOLDS.pendingJobsHigh) {
    alerts.push({
      id: 'pending-high',
      severity: 'high',
      message: `${metrics.pendingJobsCount} trabajos sin aceptar — revisar disponibilidad de técnicos`,
    });
  } else if (metrics.pendingJobsCount >= ALERT_THRESHOLDS.pendingJobsMedium) {
    alerts.push({
      id: 'pending-medium',
      severity: 'medium',
      message: `${metrics.pendingJobsCount} trabajos esperando técnico`,
    });
  }

  if (
    metrics.avgAcceptanceMinutes != null
    && metrics.avgAcceptanceMinutes >= ALERT_THRESHOLDS.avgAcceptanceMinutesHigh
  ) {
    alerts.push({
      id: 'acceptance-slow',
      severity: 'medium',
      message: `Tiempo de aceptación alto (${formatDurationMinutes(metrics.avgAcceptanceMinutes)} promedio)`,
    });
  }

  if (
    availableWorkersCount <= ALERT_THRESHOLDS.fewAvailableWorkers
    && metrics.pendingJobsCount > 0
  ) {
    alerts.push({
      id: 'few-workers',
      severity: 'high',
      message: `Solo ${availableWorkersCount} técnico(s) disponible(s) con ${metrics.pendingJobsCount} trabajo(s) esperando`,
    });
  }

  if (metrics.criticalJobsCount > 0) {
    alerts.push({
      id: 'critical-jobs',
      severity: 'high',
      message: `${metrics.criticalJobsCount} trabajo(s) en curso hace más de ${RADAR_ALERT_HOURS}h — requieren intervención`,
    });
  }

  const completedAndCancelled = kpis.completedThisMonth + kpis.cancelledThisMonth;
  if (
    completedAndCancelled > 0
    && kpis.cancelledThisMonth / completedAndCancelled >= ALERT_THRESHOLDS.cancellationRatioHigh
  ) {
    alerts.push({
      id: 'cancellations-high',
      severity: 'medium',
      message: `Cancelaciones altas este mes (${kpis.cancelledThisMonth} de ${completedAndCancelled})`,
    });
  }

  return alerts;
};

// ─── Analíticas avanzadas (embudo, retención, horas pico) ──────────────────
// Se calculan sobre TODO el historial que fetchAdminJobs() ya trae (sin límite
// de fecha) — no es una ventana "este mes" como los KPIs de arriba.

export interface FunnelMetrics {
  openCount: number;
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  /** % de jobs no-abiertos que terminaron completados. null si no hay datos. */
  conversionRate: number | null;
}

export const computeFunnelMetrics = (jobs: AdminJob[]): FunnelMetrics => {
  const openCount = jobs.filter((j) => j.status === 'open' || j.status === 'pending').length;
  const activeCount = getRadarJobs(jobs).length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const cancelledCount = jobs.filter((j) => j.status === 'cancelled').length;

  const decided = jobs.length - openCount; // jobs que ya salieron del estado "abierto"
  const conversionRate = decided > 0 ? (completedCount / decided) * 100 : null;

  return { openCount, activeCount, completedCount, cancelledCount, conversionRate };
};

export interface RetentionMetrics {
  totalClients: number;
  repeatClients: number;
  /** % de clientes con más de 1 solicitud alguna vez. null si no hay clientes todavía. */
  retentionRate: number | null;
}

export const computeRetentionMetrics = (jobs: AdminJob[]): RetentionMetrics => {
  const jobsByClient = new Map<string, number>();
  for (const j of jobs) {
    jobsByClient.set(j.created_by, (jobsByClient.get(j.created_by) ?? 0) + 1);
  }
  const totalClients = jobsByClient.size;
  const repeatClients = [...jobsByClient.values()].filter((count) => count > 1).length;
  const retentionRate = totalClients > 0 ? (repeatClients / totalClients) * 100 : null;

  return { totalClients, repeatClients, retentionRate };
};

export interface PeakHour {
  hour: number;
  count: number;
}

/** Top 3 horas del día con más solicitudes creadas, sobre todo el historial. */
export const computePeakHours = (jobs: AdminJob[]): PeakHour[] => {
  const buckets = new Array(24).fill(0) as number[];
  for (const j of jobs) {
    const h = new Date(j.created_at).getHours();
    if (h >= 0 && h < 24) buckets[h] += 1;
  }
  return buckets
    .map((count, hour) => ({ hour, count }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
};

export const formatHourLabel = (hour: number): string => {
  const period = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${period}`;
};
