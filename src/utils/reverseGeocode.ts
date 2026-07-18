/**
 * Geocodificación inversa (coordenadas → departamento + municipio).
 * Nativo: geocoder del sistema vía expo-location. Web: Nominatim (OpenStreetMap),
 * mismo ecosistema OSM que ya usan los mapas (OpenFreeMap). Sin API key.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface GeoPlace {
  department: string | null;
  municipality: string | null;
}

const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
};

export async function reverseGeocodePlace(lat: number, lng: number): Promise<GeoPlace | null> {
  try {
    if (Platform.OS === 'web') {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
        `&lat=${lat}&lon=${lng}&zoom=12&accept-language=es`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      const a = (data?.address ?? {}) as Record<string, unknown>;
      return {
        department: clean(a.state) ?? clean(a.region),
        municipality:
          clean(a.county) ?? clean(a.city) ?? clean(a.town) ??
          clean(a.village) ?? clean(a.municipality) ?? clean(a.suburb),
      };
    }

    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const r = results?.[0];
    if (!r) return null;
    return {
      department: clean(r.region) ?? clean(r.subregion),
      municipality: clean(r.city) ?? clean(r.subregion) ?? clean(r.district),
    };
  } catch {
    return null;
  }
}

/** "Departamento, Municipio" (o lo que exista); usa `fallback` si no hay datos. */
export function formatPlaceLabel(place: GeoPlace | null, fallback: string): string {
  if (!place) return fallback;
  const { department, municipality } = place;
  if (department && municipality && department !== municipality) {
    return `${department}, ${municipality}`;
  }
  return department ?? municipality ?? fallback;
}
