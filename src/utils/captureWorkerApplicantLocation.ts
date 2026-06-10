/**
 * Ubicación del técnico al postular — best-effort, nunca bloquea accept_job.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { hasUsableJobCoordinates } from '@utils/shareJobLocation';

const WEB_TIMEOUT_MS = 12_000;

function readWebPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: WEB_TIMEOUT_MS,
      maximumAge: 120_000,
    });
  });
}

export async function captureWorkerApplicantLocation(): Promise<{
  lat: number;
  lng: number;
} | null> {
  try {
    if (Platform.OS === 'web') {
      const pos = await readWebPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      return hasUsableJobCoordinates(lat, lng) ? { lat, lng } : null;
    }

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') return null;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    return hasUsableJobCoordinates(lat, lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
