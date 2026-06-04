import type { Job, JobStatus, WorkerOperationalPhase } from '@/types';

export const OPERATIONAL_STEPS: {
  phase: WorkerOperationalPhase;
  label: string;
  shortLabel: string;
}[] = [
  { phase: 'accepted', label: 'Aceptado', shortLabel: 'Aceptado' },
  { phase: 'en_route', label: 'En camino', shortLabel: 'Viaje' },
  { phase: 'arrived', label: 'En el lugar', shortLabel: 'Llegada' },
  { phase: 'completed', label: 'Finalizado', shortLabel: 'Listo' },
];

const PHASE_RANK: Record<WorkerOperationalPhase, number> = {
  accepted: 0,
  en_route: 1,
  arrived: 2,
  completed: 3,
};

export const resolveOperationalPhase = (
  job?: Partial<Job> | null,
): WorkerOperationalPhase | null => {
  if (!job?.status) return null;
  if (job.status === 'completed' || job.status === 'cancelled') return 'completed';
  if (job.operational_phase) return job.operational_phase;
  if (job.status === 'taken') return 'accepted';
  if (job.status === 'in_progress') return 'arrived';
  return null;
};

export const isActiveOperationalJob = (job?: Partial<Job> | null): boolean => {
  const phase = resolveOperationalPhase(job);
  return !!phase && phase !== 'completed';
};

export const getNextOperationalPhase = (
  current: WorkerOperationalPhase,
): WorkerOperationalPhase | null => {
  const idx = PHASE_RANK[current];
  if (idx >= PHASE_RANK.completed - 1) return null;
  return OPERATIONAL_STEPS[idx + 1].phase;
};

export interface PhaseActionConfig {
  label: string;
  icon: 'car-outline' | 'location-outline' | 'checkmark-circle-outline';
  needsConfirm: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmLabel?: string;
}

export const getPhaseAction = (
  phase: WorkerOperationalPhase | null,
): PhaseActionConfig | null => {
  switch (phase) {
    case 'accepted':
      return {
        label: 'Iniciar viaje al destino',
        icon: 'car-outline',
        needsConfirm: false,
      };
    case 'en_route':
      return {
        label: 'He llegado al lugar',
        icon: 'location-outline',
        needsConfirm: false,
      };
    case 'arrived':
      return {
        label: 'Marcar como Finalizado',
        icon: 'checkmark-circle-outline',
        needsConfirm: true,
        confirmTitle: '¿Finalizar servicio?',
        confirmMessage:
          'El cliente y el administrador verán el estado Finalizado en su historial.',
        confirmLabel: 'Finalizar',
      };
    default:
      return null;
  }
};

export type StepVisualState = 'done' | 'active' | 'upcoming';

export const getStepVisualState = (
  stepPhase: WorkerOperationalPhase,
  current: WorkerOperationalPhase | null,
): StepVisualState => {
  if (!current) return 'upcoming';
  const stepRank = PHASE_RANK[stepPhase];
  const currentRank = PHASE_RANK[current];
  if (stepRank < currentRank) return 'done';
  if (stepRank === currentRank) return 'active';
  return 'upcoming';
};

export const preferOperationalPhase = (
  a?: WorkerOperationalPhase | null,
  b?: WorkerOperationalPhase | null,
): WorkerOperationalPhase | undefined => {
  if (!a) return b ?? undefined;
  if (!b) return a;
  return PHASE_RANK[b] >= PHASE_RANK[a] ? b : a;
};

export const phaseToJobStatus = (
  phase: WorkerOperationalPhase,
  currentStatus?: JobStatus,
): JobStatus => {
  if (phase === 'completed') return 'completed';
  if (phase === 'arrived') return 'in_progress';
  if (phase === 'en_route') return 'taken';
  if (currentStatus === 'in_progress') return 'in_progress';
  return 'taken';
};

export const getClientPhaseMessage = (phase: WorkerOperationalPhase): {
  title: string;
  body: string;
} => {
  switch (phase) {
    case 'en_route':
      return {
        title: 'Tu técnico va en camino',
        body: 'El técnico inició el viaje hacia tu ubicación.',
      };
    case 'arrived':
      return {
        title: 'Tu técnico llegó',
        body: 'El técnico está en el lugar. Pronto comenzará el servicio.',
      };
  }
  return { title: 'Actualización de tu chamba', body: 'Hay novedades en tu servicio.' };
};
