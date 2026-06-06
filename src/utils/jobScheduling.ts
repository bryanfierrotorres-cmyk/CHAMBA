import type { UrgencyLevel } from '@/types';

export type { UrgencyLevel };

const URGENCY_LEVELS: UrgencyLevel[] = ['hoy', 'manana', 'programado'];

export const URGENCY_OPTIONS: Array<{
  id: UrgencyLevel;
  label: string;
  hint: string;
}> = [
  { id: 'hoy', label: 'Hoy', hint: 'Lo antes posible' },
  { id: 'manana', label: 'Mañana', hint: 'Para el día siguiente' },
  { id: 'programado', label: 'Programado', hint: 'Elegí fecha' },
];

export const normalizeUrgencyLevel = (value: unknown): UrgencyLevel => {
  const raw = String(value ?? 'hoy').trim().toLowerCase();
  return URGENCY_LEVELS.includes(raw as UrgencyLevel) ? (raw as UrgencyLevel) : 'hoy';
};

export const getLocalDateString = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatScheduleDateLabel = (dateStr: string): string => {
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return dateStr;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-NI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

export const formatUrgencyLabel = (level: UrgencyLevel | string | null | undefined): string => {
  const normalized = normalizeUrgencyLevel(level);
  const match = URGENCY_OPTIONS.find((o) => o.id === normalized);
  return match?.label ?? 'Hoy';
};

export interface JobSchedulingInput {
  urgencyLevel?: UrgencyLevel | string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduledAt?: string | null;
}

export interface ResolvedJobScheduling {
  urgencyLevel: UrgencyLevel;
  scheduledDate: string | null;
  scheduledTime: string | null;
  scheduledAt: string | null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Normaliza hora a HH:mm:ss para Postgres TIME. */
export const normalizeScheduledTime = (value: string | null | undefined): string | null => {
  if (!value?.trim()) return null;
  const match = value.trim().match(TIME_HM);
  if (!match) return null;
  const hh = match[1].padStart(2, '0');
  const mm = match[2];
  const ss = match[3] ?? '00';
  return `${hh}:${mm}:${ss}`;
};

/** Etiqueta legible para TIME de Postgres (HH:mm:ss). */
export const formatScheduleTimeLabel = (timeStr: string | null | undefined): string => {
  const normalized = normalizeScheduledTime(timeStr);
  if (!normalized) return '';
  const [hh, mm] = normalized.split(':').map(Number);
  const date = new Date();
  date.setHours(hh, mm, 0, 0);
  return date.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
};

export const formatJobScheduleSummary = (job: {
  urgency_level?: UrgencyLevel | string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}): string => {
  const urgency = normalizeUrgencyLevel(job.urgency_level);
  if (urgency === 'hoy') return 'Hoy';
  if (urgency === 'manana') {
    return job.scheduled_date
      ? `Mañana · ${formatScheduleDateLabel(job.scheduled_date)}`
      : 'Mañana';
  }
  if (job.scheduled_date) {
    const time = formatScheduleTimeLabel(job.scheduled_time);
    return time
      ? `${formatScheduleDateLabel(job.scheduled_date)} · ${time}`
      : formatScheduleDateLabel(job.scheduled_date);
  }
  return 'Programado';
};

const parseDateFromIso = (iso: string): string | null => {
  const d = iso.slice(0, 10);
  return DATE_ONLY.test(d) ? d : null;
};

/**
 * Resuelve programación con defaults seguros para publicación.
 * El cliente puede omitir fecha/hora; urgency_level cae en 'hoy'.
 */
export const resolveJobScheduling = (input: JobSchedulingInput = {}): ResolvedJobScheduling => {
  let urgencyLevel = normalizeUrgencyLevel(input.urgencyLevel);
  let scheduledDate = input.scheduledDate?.trim() || null;
  let scheduledTime = normalizeScheduledTime(input.scheduledTime);
  let scheduledAt = input.scheduledAt?.trim() || null;

  if (!scheduledDate && scheduledAt) {
    scheduledDate = parseDateFromIso(scheduledAt);
    if (!scheduledTime && scheduledAt.includes('T')) {
      const timePart = scheduledAt.split('T')[1]?.slice(0, 8);
      scheduledTime = normalizeScheduledTime(timePart ?? null);
    }
  }

  if (scheduledDate && !DATE_ONLY.test(scheduledDate)) {
    scheduledDate = null;
  }

  if (urgencyLevel === 'programado' && !scheduledDate) {
    urgencyLevel = 'hoy';
  }

  return {
    urgencyLevel,
    scheduledDate,
    scheduledTime,
    scheduledAt,
  };
};
