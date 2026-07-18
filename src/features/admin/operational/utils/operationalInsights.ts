import type { AdminJob } from '../../services/adminService';

/**
 * Centro de Inteligencia Operacional — motor de recomendaciones automáticas.
 *
 * Reglas puras sobre los jobs que fetchAdminJobs() ya trae (historial completo,
 * sin LIMIT) + el conteo de técnicos disponibles que el Dashboard ya consulta.
 * Cero queries nuevas. Cada regla tiene un mínimo de muestra para no emitir
 * recomendaciones con datos insuficientes (mejor callar que recomendar mal).
 */

export type InsightKind = 'warning' | 'opportunity' | 'info';

export interface OperationalInsight {
  id: string;
  kind: InsightKind;
  /** Recomendación accionable, una frase. */
  title: string;
  /** Evidencia con números que respalda la recomendación. */
  detail: string;
}

const MIN_SAMPLE = 5;

const monthKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
};

const shiftMonthKey = (now: Date, offset: number): string => {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${d.getMonth()}`;
};

const pct = (n: number): string => `${Math.round(n)}%`;

/** Crecimiento/caída de demanda por categoría: mes actual vs mes anterior. */
const categoryTrendInsights = (
  jobs: AdminJob[],
  label: (slug: string) => string,
  now: Date,
): OperationalInsight[] => {
  const thisKey = shiftMonthKey(now, 0);
  const prevKey = shiftMonthKey(now, -1);
  const counts = new Map<string, { current: number; previous: number }>();

  for (const job of jobs) {
    const key = monthKey(job.created_at);
    if (key !== thisKey && key !== prevKey) continue;
    const slug = (job.category ?? 'otro').toLowerCase();
    const entry = counts.get(slug) ?? { current: 0, previous: 0 };
    if (key === thisKey) entry.current += 1;
    else entry.previous += 1;
    counts.set(slug, entry);
  }

  const out: OperationalInsight[] = [];
  for (const [slug, { current, previous }] of counts) {
    if (previous < MIN_SAMPLE) continue;
    const growth = ((current - previous) / previous) * 100;
    if (growth >= 25) {
      out.push({
        id: `cat-growth-${slug}`,
        kind: 'opportunity',
        title: `"${label(slug)}" creció ${pct(growth)} este mes — oportunidad para captar más técnicos de esa categoría`,
        detail: `${previous} solicitudes el mes pasado → ${current} este mes.`,
      });
    } else if (growth <= -30) {
      out.push({
        id: `cat-decline-${slug}`,
        kind: 'warning',
        title: `La demanda de "${label(slug)}" cayó ${pct(Math.abs(growth))} este mes — revisa precios o cobertura`,
        detail: `${previous} solicitudes el mes pasado → ${current} este mes.`,
      });
    }
  }
  return out;
};

/** Categorías con tasa de cancelación muy por encima del promedio global. */
const categoryCancellationInsights = (
  jobs: AdminJob[],
  label: (slug: string) => string,
): OperationalInsight[] => {
  const perCategory = new Map<string, { total: number; cancelled: number }>();
  let globalTotal = 0;
  let globalCancelled = 0;

  for (const job of jobs) {
    if (job.status !== 'completed' && job.status !== 'cancelled') continue;
    const slug = (job.category ?? 'otro').toLowerCase();
    const entry = perCategory.get(slug) ?? { total: 0, cancelled: 0 };
    entry.total += 1;
    globalTotal += 1;
    if (job.status === 'cancelled') { entry.cancelled += 1; globalCancelled += 1; }
    perCategory.set(slug, entry);
  }

  if (globalTotal < MIN_SAMPLE * 2) return [];
  const globalRate = (globalCancelled / globalTotal) * 100;

  const out: OperationalInsight[] = [];
  for (const [slug, { total, cancelled }] of perCategory) {
    if (total < MIN_SAMPLE) continue;
    const rate = (cancelled / total) * 100;
    if (rate >= 20 && rate >= globalRate * 2) {
      out.push({
        id: `cat-cancel-${slug}`,
        kind: 'warning',
        title: `"${label(slug)}" cancela al ${pct(rate)}, muy por encima del promedio (${pct(globalRate)}) — revisa calidad o precios en esa categoría`,
        detail: `${cancelled} de ${total} servicios terminaron cancelados.`,
      });
    }
  }
  return out;
};

/** Franja de 2 horas que concentra la demanda de los últimos 30 días. */
const peakWindowInsight = (jobs: AdminJob[], now: Date): OperationalInsight[] => {
  const cutoff = now.getTime() - 30 * 24 * 3600_000;
  const recent = jobs.filter((j) => new Date(j.created_at).getTime() >= cutoff);
  if (recent.length < MIN_SAMPLE * 2) return [];

  const byHour = new Array<number>(24).fill(0);
  for (const job of recent) byHour[new Date(job.created_at).getHours()] += 1;

  let bestStart = 0;
  let bestCount = -1;
  for (let h = 0; h < 24; h++) {
    const windowCount = byHour[h] + byHour[(h + 1) % 24];
    if (windowCount > bestCount) { bestCount = windowCount; bestStart = h; }
  }

  const share = (bestCount / recent.length) * 100;
  if (share < 25) return [];

  const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return [{
    id: 'peak-window',
    kind: 'opportunity',
    title: `El ${pct(share)} de la demanda se concentra entre ${fmt(bestStart)} y ${fmt((bestStart + 2) % 24)} — conviene incentivar técnicos disponibles en esa franja`,
    detail: `${bestCount} de ${recent.length} solicitudes de los últimos 30 días.`,
  }];
};

/** Tendencia del tiempo de espera del cliente (creación → primera asignación). */
const acceptanceTrendInsight = (jobs: AdminJob[], now: Date): OperationalInsight[] => {
  const thisKey = shiftMonthKey(now, 0);
  const prevKey = shiftMonthKey(now, -1);
  const current: number[] = [];
  const previous: number[] = [];

  for (const job of jobs) {
    const first = job.assignments?.[0];
    if (!first?.assigned_at) continue;
    const minutes = (new Date(first.assigned_at).getTime() - new Date(job.created_at).getTime()) / 60_000;
    if (!Number.isFinite(minutes) || minutes < 0) continue;
    const key = monthKey(job.created_at);
    if (key === thisKey) current.push(minutes);
    else if (key === prevKey) previous.push(minutes);
  }

  if (current.length < MIN_SAMPLE || previous.length < MIN_SAMPLE) return [];
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const avgNow = avg(current);
  const avgPrev = avg(previous);
  if (avgPrev <= 0) return [];
  const change = ((avgNow - avgPrev) / avgPrev) * 100;

  const fmtMin = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);
  if (change >= 25) {
    return [{
      id: 'acceptance-worse',
      kind: 'warning',
      title: `Los clientes esperan en promedio ${fmtMin(avgNow)} por un técnico, ${pct(change)} más que el mes pasado — considera ampliar cobertura`,
      detail: `Promedio anterior: ${fmtMin(avgPrev)} (${previous.length} servicios) → actual: ${fmtMin(avgNow)} (${current.length}).`,
    }];
  }
  if (change <= -25) {
    return [{
      id: 'acceptance-better',
      kind: 'info',
      title: `El tiempo de espera del cliente mejoró ${pct(Math.abs(change))} este mes (${fmtMin(avgNow)} promedio)`,
      detail: `Promedio anterior: ${fmtMin(avgPrev)} (${previous.length} servicios) → actual: ${fmtMin(avgNow)} (${current.length}).`,
    }];
  }
  return [];
};

/** Técnicos que concentran los servicios cancelados tras haber sido asignados. */
const workerCancellationInsight = (jobs: AdminJob[]): OperationalInsight[] => {
  const cancelledAssigned = jobs.filter(
    (j) => j.status === 'cancelled' && (j.assignments?.length ?? 0) > 0,
  );
  if (cancelledAssigned.length < MIN_SAMPLE) return [];

  const perWorker = new Map<string, { name: string; count: number }>();
  for (const job of cancelledAssigned) {
    for (const a of job.assignments) {
      const name = a.worker?.full_name ?? 'Técnico sin nombre';
      const entry = perWorker.get(a.worker_id) ?? { name, count: 0 };
      entry.count += 1;
      perWorker.set(a.worker_id, entry);
    }
  }

  const top = [...perWorker.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  const topCount = top.reduce((sum, w) => sum + w.count, 0);
  const share = (topCount / cancelledAssigned.length) * 100;
  if (share < 40) return [];

  return [{
    id: 'worker-cancel-concentration',
    kind: 'warning',
    title: `${top.length} técnico${top.length === 1 ? '' : 's'} concentra${top.length === 1 ? '' : 'n'} el ${pct(share)} de los servicios cancelados tras asignación — revisa sus casos en Equipo`,
    detail: top.map((w) => `${w.name} (${w.count})`).join(' · '),
  }];
};

/** Desbalance oferta/demanda ahora mismo. */
const supplyDemandInsight = (
  jobs: AdminJob[],
  availableWorkers: number,
): OperationalInsight[] => {
  const open = jobs.filter((j) => j.status === 'open' || j.status === 'pending').length;

  if (open >= MIN_SAMPLE && open > availableWorkers * 2) {
    return [{
      id: 'supply-gap',
      kind: 'warning',
      title: `Hay ${open} solicitudes abiertas y solo ${availableWorkers} técnico${availableWorkers === 1 ? '' : 's'} disponible${availableWorkers === 1 ? '' : 's'} — la oferta no alcanza, incentiva conexiones`,
      detail: 'Más de 2 solicitudes por técnico disponible ahora mismo.',
    }];
  }
  if (availableWorkers >= MIN_SAMPLE && open === 0) {
    return [{
      id: 'demand-gap',
      kind: 'opportunity',
      title: `${availableWorkers} técnicos están disponibles sin solicitudes abiertas — buen momento para promocionar la app con clientes`,
      detail: 'Capacidad ociosa: toda promoción de demanda se atenderá rápido.',
    }];
  }
  return [];
};

const KIND_PRIORITY: Record<InsightKind, number> = { warning: 0, opportunity: 1, info: 2 };

export const computeOperationalInsights = (
  jobs: AdminJob[],
  availableWorkers: number,
  label: (slug: string) => string,
  now: Date = new Date(),
): OperationalInsight[] => [
  ...categoryTrendInsights(jobs, label, now),
  ...categoryCancellationInsights(jobs, label),
  ...peakWindowInsight(jobs, now),
  ...acceptanceTrendInsight(jobs, now),
  ...workerCancellationInsight(jobs),
  ...supplyDemandInsight(jobs, availableWorkers),
].sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);
