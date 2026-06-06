import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { formatCurrency } from '@utils/formatters';
import { hasUsableJobCoordinates } from '@utils/shareJobLocation';
import { RADAR_DEEP_BLUE } from './radarTheme';
import type { Job } from '@/types';

const MANAGUA_REGION = {
  latitude: 12.1364,
  longitude: -86.2514,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
} as const;

interface RadarPin {
  jobId: string;
  title: string;
  price: string;
  latitude: number;
  longitude: number;
}

const mapRegionForPins = (pins: RadarPin[]) => {
  if (pins.length === 0) return MANAGUA_REGION;
  if (pins.length === 1) {
    return {
      latitude: pins[0].latitude,
      longitude: pins[0].longitude,
      latitudeDelta: 0.025,
      longitudeDelta: 0.025,
    };
  }
  const lats = pins.map((p) => p.latitude);
  const lngs = pins.map((p) => p.longitude);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lngSpan = Math.max(...lngs) - Math.min(...lngs);
  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(0.03, latSpan * 1.6 + 0.02),
    longitudeDelta: Math.max(0.03, lngSpan * 1.6 + 0.02),
  };
};

interface RadarFullMapProps {
  jobs: Job[];
}

export const RadarFullMap: React.FC<RadarFullMapProps> = ({ jobs }) => {
  const pins = useMemo(() => {
    return jobs
      .map((job): RadarPin | null => {
        const lat = job.location?.lat ?? 0;
        const lng = job.location?.lng ?? 0;
        if (!hasUsableJobCoordinates(lat, lng)) return null;
        return {
          jobId: job.id,
          title: job.title?.trim() || 'Solicitud',
          price: formatCurrency(job.worker_payout || job.pay_amount),
          latitude: lat,
          longitude: lng,
        };
      })
      .filter((p): p is RadarPin => p !== null);
  }, [jobs]);

  const region = useMemo(() => mapRegionForPins(pins), [pins]);
  const isEmpty = jobs.length === 0;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region}>
        {pins.map((pin) => (
          <Marker
            key={pin.jobId}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.title}
            description={pin.price}
            pinColor={RADAR_DEEP_BLUE}
          />
        ))}
      </MapView>

      {isEmpty && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyTitle}>Sin solicitudes en tu zona</Text>
          <Text style={styles.emptySub}>
            Cuando haya chambas abiertas, verás los puntos en el mapa
          </Text>
        </View>
      )}

      {!isEmpty && pins.length === 0 && (
        <View style={styles.hintOverlay} pointerEvents="none">
          <Text style={styles.hintText}>
            Sin coordenadas GPS — revisá la dirección en cada solicitud
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E5E7EB',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 250, 252, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  hintOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: '22%',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  hintText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 17,
  },
});
