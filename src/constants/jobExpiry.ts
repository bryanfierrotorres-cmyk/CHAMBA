/** Ventana de visibilidad en radar / espera activa: 60 minutos desde publicación o impulso. */
export const JOB_RADAR_EXPIRY_MS = 60 * 60 * 1000;

export const getJobExpiryAtMs = (createdAt: string): number =>
  new Date(createdAt).getTime() + JOB_RADAR_EXPIRY_MS;

export const getJobRemainingMs = (createdAt: string, now = Date.now()): number =>
  Math.max(0, getJobExpiryAtMs(createdAt) - now);

export const isJobExpiredLocally = (createdAt: string, now = Date.now()): boolean =>
  getJobRemainingMs(createdAt, now) <= 0;

export const formatExpiryCountdown = (remainingMs: number): string => {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

/** ISO mínimo para filtrar jobs open recientes en consultas (now - 60 min). */
export const getJobRadarMinCreatedAtIso = (now = Date.now()): string =>
  new Date(now - JOB_RADAR_EXPIRY_MS).toISOString();
