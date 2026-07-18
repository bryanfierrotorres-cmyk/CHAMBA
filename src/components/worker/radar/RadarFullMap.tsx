import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import MapView from '@components/maps/ChambaMap';
import { ChambaMapMarker } from '@components/maps/ChambaMapMarker';
import { RadarSweepOverlay } from './RadarSweepOverlay';
import { formatCurrency } from '@utils/formatters';
import { hasUsableJobCoordinates } from '@utils/shareJobLocation';
import type { Job } from '@/types';

/**
 * Desplazamiento vertical (px) del centro visual hacia abajo. El mapa ya no llega
 * al tope superior (arranca sobre la barra de radio), así que solo hace falta un
 * pequeño empuje para dejar el punto azul cómodo sobre la hoja inferior. El mapa
 * se desplaza con el MISMO offset, así el punto sigue coincidiendo con la ubicación.
 */
const RADAR_CENTER_OFFSET_Y = 20;

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
  categorySlug: string;
  latitude: number;
  longitude: number;
}

interface WorkerCoords {
  latitude: number;
  longitude: number;
}

const KM_PER_DEGREE_LAT = 111;

/** Convierte el radio (km) al span en grados de latitud que debe mostrar el mapa (diámetro + 35% margen). */
const radiusToDelta = (radiusKm: number): number =>
  Math.max(0.02, (radiusKm * 2 * 1.35) / KM_PER_DEGREE_LAT);

/**
 * El técnico siempre queda en el centro exacto del mapa (como apps de despacho) y
 * el zoom depende únicamente del radio elegido — no de los pines ni del arrastre.
 * El radar se dibuja centrado sobre este mismo punto, así que ambos coinciden.
 */
const computeRadarRegion = (
  workerCoords: WorkerCoords | null,
  radiusKm: number,
  pins: RadarPin[],
) => {
  if (workerCoords) {
    const delta = radiusToDelta(radiusKm);
    return {
      latitude: workerCoords.latitude,
      longitude: workerCoords.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }

  // Sin ubicación del técnico el radar no se enciende; este fallback solo aplica
  // a estados transitorios (mapa de fondo mientras se resuelve el GPS).
  if (pins.length === 0) return MANAGUA_REGION;
  const lats = pins.map((p) => p.latitude);
  const lngs = pins.map((p) => p.longitude);
  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };
};

interface RadarFullMapProps {
  jobs: Job[];
  /** Hint opcional bajo el mensaje de búsqueda (ej. filtro activo). */
  searchHint?: string;
  /** Técnico en línea y buscando — activa el radar central sobre el mapa. */
  isSearching?: boolean;
  /** Última ubicación GPS conocida del técnico — centra el mapa y el radar en ella. */
  workerLat?: number | null;
  workerLng?: number | null;
  /** Radio de búsqueda (km) — controla el nivel de zoom automático del mapa. */
  radiusKm?: number;
}

export const RadarFullMap: React.FC<RadarFullMapProps> = ({
  jobs,
  searchHint,
  isSearching = true,
  workerLat,
  workerLng,
  radiusKm = 8,
}) => {
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
          categorySlug: job.category,
          latitude: lat,
          longitude: lng,
        };
      })
      .filter((p): p is RadarPin => p !== null);
  }, [jobs]);

  const workerCoords = useMemo<WorkerCoords | null>(
    () => (hasUsableJobCoordinates(workerLat, workerLng) ? { latitude: workerLat!, longitude: workerLng! } : null),
    [workerLat, workerLng],
  );
  const region = useMemo(
    () => computeRadarRegion(workerCoords, radiusKm, pins),
    [workerCoords, radiusKm, pins],
  );
  /** El radar giratorio se dibuja centrado sobre la ubicación del técnico mientras busca. */
  const showSweep = isSearching;

  // Aparición/desaparición suave del radar al cambiar disponibilidad (no de golpe).
  const sweepOpacity = useRef(new Animated.Value(showSweep ? 1 : 0)).current;
  const [sweepMounted, setSweepMounted] = useState(showSweep);

  useEffect(() => {
    if (showSweep) {
      setSweepMounted(true);
      Animated.timing(sweepOpacity, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sweepOpacity, {
        toValue: 0,
        duration: 340,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setSweepMounted(false);
      });
    }
  }, [showSweep, sweepOpacity]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        centerOffsetY={RADAR_CENTER_OFFSET_Y}
      >
        {pins.map((pin) => (
          <ChambaMapMarker
            key={pin.jobId}
            id={pin.jobId}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.title}
            description={pin.price}
            categorySlug={pin.categorySlug}
          />
        ))}
      </MapView>

      {sweepMounted && (
        <Animated.View style={[styles.sweepCenterOverlay, { opacity: sweepOpacity }]} pointerEvents="none">
          <View style={{ transform: [{ translateY: RADAR_CENTER_OFFSET_Y }] }}>
            <RadarSweepOverlay size={170} />
          </View>
        </Animated.View>
      )}

      {!isSearching && jobs.length > 0 && pins.length === 0 && (
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
  sweepCenterOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
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
