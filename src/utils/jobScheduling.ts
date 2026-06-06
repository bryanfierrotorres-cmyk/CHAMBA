import type { UrgencyLevel } from '@/types';

export type { UrgencyLevel };

const URGENCY_LEVELS: UrgencyLevel[] = ['hoy', 'manana', 'programado'];

export const normalizeUrgencyLevel = (value: unknown): UrgencyLevel => {
  const raw = String(value ?? 'hoy').trim().toLowerCase();
  return URGENCY_LEVELS.includes(raw as UrgencyLevel) ? (raw as UrgencyLevel) : 'hoy';
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
