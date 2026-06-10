import type { JobWorkerApplication } from '@/types';
import { haversineDistanceKm } from '@utils/geoDistance';
import { hasUsableJobCoordinates } from '@utils/shareJobLocation';

export interface JobCoords {
  lat: number;
  lng: number;
}

export interface WorkerCoords {
  lat: number;
  lng: number;
}

/**
 * Distancia job ↔ técnico: RPC (distance_km) > haversine local > null.
 * Solo lectura; no persiste ni altera asignaciones.
 */
export const resolveApplicantDistanceKm = (
  app: JobWorkerApplication,
  jobCoords?: JobCoords | null,
  workerCoords?: WorkerCoords | null,
): number | null => {
  const fromRpc = app.distance_km;
  if (fromRpc != null && Number.isFinite(fromRpc) && fromRpc > 0) {
    return fromRpc;
  }

  const jobLat = jobCoords?.lat;
  const jobLng = jobCoords?.lng;
  const workerLat = workerCoords?.lat ?? app.worker_lat ?? null;
  const workerLng = workerCoords?.lng ?? app.worker_lng ?? null;

  if (
    !hasUsableJobCoordinates(jobLat, jobLng)
    || !hasUsableJobCoordinates(workerLat, workerLng)
  ) {
    return null;
  }

  const km = haversineDistanceKm(jobLat!, jobLng!, workerLat!, workerLng!);
  return Number.isFinite(km) ? km : null;
};
