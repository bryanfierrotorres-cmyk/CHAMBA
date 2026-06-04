import { Linking, Platform } from 'react-native';

export interface JobMapTarget {
  lat?: number;
  lng?: number;
  address?: string | null;
}

function buildMapsUrl(target: JobMapTarget): string | null {
  const lat = target.lat ?? 0;
  const lng = target.lng ?? 0;
  const hasCoords = lat !== 0 || lng !== 0;
  const address = target.address?.trim();

  if (hasCoords) {
    if (Platform.OS === 'web') {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    if (Platform.OS === 'ios') {
      return `http://maps.apple.com/?ll=${lat},${lng}`;
    }
    if (Platform.OS === 'android') {
      return `geo:${lat},${lng}?q=${lat},${lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  if (address) {
    const q = encodeURIComponent(address);
    if (Platform.OS === 'ios') {
      return `http://maps.apple.com/?q=${q}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  return null;
}

function buildMapsFallbackUrl(target: JobMapTarget): string | null {
  const lat = target.lat ?? 0;
  const lng = target.lng ?? 0;
  const hasCoords = lat !== 0 || lng !== 0;
  const address = target.address?.trim();
  if (hasCoords) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return null;
}

/**
 * Abre la app de mapas del dispositivo (Google Maps / Apple Maps) con coordenadas o dirección.
 */
export async function openJobLocationInMaps(target: JobMapTarget): Promise<void> {
  const primary = buildMapsUrl(target);
  if (!primary) return;

  try {
    const supported = await Linking.canOpenURL(primary);
    await Linking.openURL(supported ? primary : (buildMapsFallbackUrl(target) ?? primary));
  } catch {
    const fallback = buildMapsFallbackUrl(target);
    if (fallback) await Linking.openURL(fallback);
  }
}
