import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface SharedJobCoordinates {
  lat: number;
  lng: number;
  /** Texto aproximado desde geocodificación inversa (opcional). */
  addressHint?: string;
}

const WEB_TIMEOUT_MS = 18_000;

function readWebPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Tu navegador no permite obtener ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: WEB_TIMEOUT_MS,
      maximumAge: 45_000,
    });
  });
}

async function reverseGeocodeHint(lat: number, lng: number): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!place) return undefined;
    const parts = [
      place.streetNumber ? `${place.streetNumber} ${place.street ?? ''}`.trim() : place.street,
      place.district,
      place.city,
      place.region,
    ].filter(Boolean);
    return parts.join(', ') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Obtiene la ubicación actual del cliente para adjuntarla a una solicitud de servicio.
 */
export async function captureClientJobLocation(): Promise<SharedJobCoordinates> {
  if (Platform.OS === 'web') {
    const pos = await readWebPosition();
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(
      'Necesitamos permiso de ubicación para que el técnico sepa dónde ir. Activalo en Ajustes.',
    );
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const addressHint = await reverseGeocodeHint(lat, lng);

  return { lat, lng, addressHint };
}

export const hasUsableJobCoordinates = (
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean =>
  lat != null &&
  lng != null &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001);

export const formatCoordsPreview = (lat: number, lng: number): string =>
  `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
