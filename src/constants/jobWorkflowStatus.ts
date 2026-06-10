/**
 * Estados canónicos alineados con Supabase (jobs.status, job_assignments.selection_status).
 * Usar estos valores en filtros UI — no strings sueltos.
 */
export const JOB_STATUS = {
  OPEN: 'open',
  TAKEN: 'taken',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type JobStatusValue = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const SELECTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type SelectionStatusValue = (typeof SELECTION_STATUS)[keyof typeof SELECTION_STATUS];

/** Fase operativa del técnico en campo (jobs.operational_phase). */
export const OPERATIONAL_PHASE = {
  ACCEPTED: 'accepted',
  EN_ROUTE: 'en_route',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
} as const;

export type OperationalPhaseValue = (typeof OPERATIONAL_PHASE)[keyof typeof OPERATIONAL_PHASE];

/** Tras aprobación del cliente: jobs + assignment quedan así. */
export const CLIENT_APPROVED_JOB_STATE = {
  jobStatus: JOB_STATUS.TAKEN,
  selectionStatus: SELECTION_STATUS.APPROVED,
  operationalPhase: OPERATIONAL_PHASE.ACCEPTED,
} as const;
