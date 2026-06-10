/**
 * Distancia geográfica (Haversine) — solo lectura, sin efectos secundarios.
 */

const EARTH_RADIUS_KM = 6371;

const isFiniteCoord = (n: number): boolean => Number.isFinite(n);

/** Distancia en km entre dos puntos WGS84 (Haversine). */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (![lat1, lng1, lat2, lng2].every(isFiniteCoord)) {
    return NaN;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Etiqueta para tarjeta de postulación: "A 2.3 km de distancia". */
export function formatApplicantDistanceLabel(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '';
  if (distanceKm < 1) {
    return `A ${Math.round(distanceKm * 1000)} m de distancia`;
  }
  return `A ${distanceKm.toFixed(1)} km de distancia`;
}
