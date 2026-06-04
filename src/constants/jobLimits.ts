/** Máximo de solicitudes activas (no finalizadas) por cliente. */
export const MAX_CLIENT_ACTIVE_JOBS = 2;

/** Máximo de chambas activas por técnico (postulación pendiente o trabajo en curso). */
export const MAX_WORKER_ACTIVE_COMMITMENTS = 2;

export const CLIENT_ACTIVE_JOBS_LIMIT_MESSAGE =
  'Ya tenés 2 solicitudes activas. Cuando una figure como finalizada, podés publicar otra.';

export const WORKER_ACTIVE_COMMITMENTS_LIMIT_MESSAGE =
  'Ya tenés 2 chambas activas (en curso o esperando al cliente). Finalizá una en Agenda para postularte a otra.';
