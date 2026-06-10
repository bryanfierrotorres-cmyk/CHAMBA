import type { Job, JobStatus, WorkerOperationalPhase, JobAssignment } from '@/types';
import { JOB_STATUS, OPERATIONAL_PHASE, SELECTION_STATUS } from '@constants/jobWorkflowStatus';
import { isWorkerCommitmentActive, isWorkerPendingClientSelection } from '@utils/jobActiveLimits';

export const OPERATIONAL_STEPS: {
  phase: WorkerOperationalPhase;
  label: string;
  shortLabel: string;
}[] = [
  { phase: OPERATIONAL_PHASE.ACCEPTED, label: 'Aceptado', shortLabel: 'Aceptado' },
  { phase: OPERATIONAL_PHASE.EN_ROUTE, label: 'En camino', shortLabel: 'Viaje' },
  { phase: OPERATIONAL_PHASE.ARRIVED, label: 'En el lugar', shortLabel: 'Llegada' },
  { phase: OPERATIONAL_PHASE.COMPLETED, label: 'Finalizado', shortLabel: 'Listo' },
];

const PHASE_RANK: Record<WorkerOperationalPhase, number> = {
  [OPERATIONAL_PHASE.ACCEPTED]: 0,
  [OPERATIONAL_PHASE.EN_ROUTE]: 1,
  [OPERATIONAL_PHASE.ARRIVED]: 2,
  [OPERATIONAL_PHASE.COMPLETED]: 3,
};

export const resolveOperationalPhase = (
  job?: Partial<Job> | null,
): WorkerOperationalPhase | null => {
  if (!job?.status) return null;
  if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.CANCELLED) {
    return OPERATIONAL_PHASE.COMPLETED;
  }
  if (job.operational_phase) return job.operational_phase;
  if (job.status === JOB_STATUS.TAKEN) return OPERATIONAL_PHASE.ACCEPTED;
  if (job.status === JOB_STATUS.IN_PROGRESS) return OPERATIONAL_PHASE.ARRIVED;
  return null;
};

export const isActiveOperationalJob = (job?: Partial<Job> | null): boolean => {
  const phase = resolveOperationalPhase(job);
  return !!phase && phase !== 'completed';
};

/** Asignación del trabajador aún en curso (Agenda → Activas). */
export const isWorkerAssignmentActive = (job?: Partial<Job> | null): boolean => {
  const status = job?.status;
  if (!status) return false;
  return status === JOB_STATUS.TAKEN || status === JOB_STATUS.IN_PROGRESS;
};

/** Asignación cerrada (Agenda → Historial). */
export const isWorkerAssignmentHistory = (job?: Partial<Job> | null): boolean => {
  const status = job?.status;
  return status === JOB_STATUS.COMPLETED || status === JOB_STATUS.CANCELLED;
};

/** Asignación visible en Agenda → Activas (en curso o postulación pendiente). */
export const isWorkerAgendaActive = (row: JobAssignment): boolean => {
  const status = row.job?.status;
  if (status === JOB_STATUS.COMPLETED || status === JOB_STATUS.CANCELLED) {
    const phase = row.job?.operational_phase;
    if (status === JOB_STATUS.COMPLETED && phase && phase !== OPERATIONAL_PHASE.COMPLETED) {
      return true;
    }
    return false;
  }

  if (row.selection_status === SELECTION_STATUS.REJECTED) {
    return false;
  }

  if (status === JOB_STATUS.TAKEN || status === JOB_STATUS.IN_PROGRESS) {
    return row.selection_status === SELECTION_STATUS.APPROVED
      || row.job?.assigned_worker_id === row.worker_id;
  }

  if (isWorkerCommitmentActive(row) || isWorkerAssignmentActive(row.job)) return true;
  return isWorkerPendingClientSelection(row);
};

/** Historial solo si el servicio terminó de verdad. */
export const isWorkerAgendaHistory = (row: JobAssignment): boolean =>
  isWorkerAssignmentHistory(row.job) && !isWorkerAgendaActive(row);

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
