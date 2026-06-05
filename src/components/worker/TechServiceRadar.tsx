import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ListRenderItem,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Card } from '@components/Card';
import { formatCurrency } from '@utils/formatters';
import { hasUsableJobCoordinates } from '@utils/shareJobLocation';
import type { Job } from '@/types';

/** Centro aproximado de Managua, Nicaragua */
const MANAGUA_REGION = {
  latitude: 12.1364,
  longitude: -86.2514,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
} as const;

const RADAR_HEIGHT = 250;
const CARD_WIDTH = 280;

interface RadarMapItem {
  jobId: string;
  title: string;
  price: string;
  distanceLabel: string;
  latitude: number;
  longitude: number;
  hasPin: boolean;
}

const jobToRadarItem = (job: Job): RadarMapItem => {
  const lat = job.location?.lat ?? 0;
  const lng = job.location?.lng ?? 0;
  const hasPin = hasUsableJobCoordinates(lat, lng);

  let distanceLabel = 'Ubicación por dirección';
  if (job.location?.distance_km != null && Number.isFinite(job.location.distance_km)) {
    distanceLabel = `A ${job.location.distance_km.toFixed(1)} km`;
  } else if (job.location?.address?.trim()) {
    const addr = job.location.address.trim();
    distanceLabel = addr.length > 42 ? `${addr.slice(0, 42)}…` : addr;
  }

  return {
    jobId: job.id,
    title: job.title?.trim() || 'Solicitud',
    price: formatCurrency(job.worker_payout || job.pay_amount),
    distanceLabel,
    latitude: hasPin ? lat : MANAGUA_REGION.latitude,
    longitude: hasPin ? lng : MANAGUA_REGION.longitude,
    hasPin,
  };
};

const mapRegionForItems = (items: RadarMapItem[]) => {
  const pins = items.filter((i) => i.hasPin);
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

interface TechServiceRadarProps {
  /** Solicitudes abiertas visibles en el radar (mismo feed que la lista). */
  jobs: Job[];
  onOpenJob: (jobId: string) => void;
}

const TechServiceRadarMap: React.FC<{ items: RadarMapItem[] }> = ({ items }) => {
  const region = useMemo(() => mapRegionForItems(items), [items]);
  const pins = items.filter((i) => i.hasPin);

  return (
    <MapView
      style={styles.map}
      initialRegion={region}
      scrollEnabled
      zoomEnabled
    >
      {pins.map((item) => (
        <Marker
          key={item.jobId}
          coordinate={{ latitude: item.latitude, longitude: item.longitude }}
          title={item.title}
          description={item.price}
          pinColor="#5AC8FA"
        />
      ))}
    </MapView>
  );
};

const ServiceCard: React.FC<{
  item: RadarMapItem;
  onOpen: (jobId: string) => void;
}> = ({ item, onOpen }) => (
  <Card style={styles.jobCard} elevated>
    <Text style={styles.jobTitle} numberOfLines={2}>
      {item.title}
    </Text>
    <View style={styles.jobMetaRow}>
      <Text style={styles.jobDistance} numberOfLines={2}>
        {item.distanceLabel}
      </Text>
      <Text style={styles.jobPrice}>{item.price}</Text>
    </View>
    <TouchableOpacity
      style={styles.detailsBtn}
      activeOpacity={0.82}
      onPress={() => onOpen(item.jobId)}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalles de ${item.title}`}
    >
      <Text style={styles.detailsBtnText}>Ver detalles</Text>
    </TouchableOpacity>
  </Card>
);

export const TechServiceRadar: React.FC<TechServiceRadarProps> = ({ jobs, onOpenJob }) => {
  const [isMapActive, setIsMapActive] = useState(false);

  const items = useMemo(() => jobs.map(jobToRadarItem), [jobs]);
  const pinCount = items.filter((i) => i.hasPin).length;

  const handleActivate = useCallback(() => {
    setIsMapActive(true);
  }, []);

  const renderServiceCard: ListRenderItem<RadarMapItem> = useCallback(
    ({ item }) => <ServiceCard item={item} onOpen={onOpenJob} />,
    [onOpenJob],
  );

  if (jobs.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.radarShell}>
        {isMapActive ? (
          <>
            <TechServiceRadarMap items={items} />
            {pinCount === 0 && (
              <View style={styles.mapOverlay} pointerEvents="none">
                <Text style={styles.mapOverlayText}>
                  Sin GPS en estas solicitudes — usá la dirección en cada tarjeta
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.inactiveLayer}>
            <TouchableOpacity
              style={styles.activateBtn}
              activeOpacity={0.85}
              onPress={handleActivate}
              accessibilityRole="button"
              accessibilityLabel="Ver chambas en el mapa"
            >
              <Text style={styles.activateBtnText}>
                VER {jobs.length} CHAMBA{jobs.length === 1 ? '' : 'S'} EN MAPA
              </Text>
            </TouchableOpacity>
            <Text style={styles.activateHint}>
              {pinCount > 0
                ? `${pinCount} con ubicación GPS en el mapa`
                : 'Toca para ver solicitudes (ubicación por dirección)'}
            </Text>
          </View>
        )}
      </View>

      {isMapActive && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.jobId}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          renderItem={renderServiceCard}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  radarShell: {
    height: RADAR_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E1E22',
  },
  inactiveLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#1E1E22',
  },
  activateBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
    backgroundColor: 'transparent',
  },
  activateBtnText: {
    color: '#F2F2F7',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  activateHint: {
    marginTop: 10,
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  map: {
    width: '100%',
    height: RADAR_HEIGHT,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 30, 34, 0.55)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 12,
  },
  mapOverlayText: {
    color: '#F2F2F7',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
  },
  carouselContent: {
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
  },
  jobCard: {
    width: CARD_WIDTH,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  jobTitle: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 22,
  },
  jobMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  jobDistance: {
    flex: 1,
    color: '#636366',
    fontSize: 13,
    fontWeight: '500',
  },
  jobPrice: {
    color: '#1C1C1E',
    fontSize: 15,
    fontWeight: '800',
  },
  detailsBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  detailsBtnText: {
    color: '#1C1C1E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
