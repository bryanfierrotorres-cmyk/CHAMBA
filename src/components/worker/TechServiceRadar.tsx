import React, { useState, useCallback } from 'react';
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

/** Centro aproximado de Managua, Nicaragua */
const MANAGUA_REGION = {
  latitude: 12.1364,
  longitude: -86.2514,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
} as const;

export interface TechRadarService {
  id: string;
  title: string;
  price: string;
  distance: string;
  latitude: number;
  longitude: number;
}

const MOCK_RADAR_SERVICES: TechRadarService[] = [
  {
    id: 'radar-1',
    title: 'Reparación de tubería',
    price: 'C$ 450',
    distance: 'A 1.5 km',
    latitude: 12.1402,
    longitude: -86.2481,
  },
  {
    id: 'radar-2',
    title: 'Instalación eléctrica',
    price: 'C$ 680',
    distance: 'A 0.8 km',
    latitude: 12.1348,
    longitude: -86.2526,
  },
  {
    id: 'radar-3',
    title: 'Mantenimiento A/C',
    price: 'C$ 920',
    distance: 'A 2.1 km',
    latitude: 12.1311,
    longitude: -86.2563,
  },
];

const RADAR_HEIGHT = 250;
const CARD_WIDTH = 280;

interface TechServiceRadarProps {
  onServiceDetails?: (service: TechRadarService) => void;
}

/** Mapa real — solo se monta cuando el técnico activa el radar (evita API de Maps en reposo). */
const TechServiceRadarMap: React.FC<{ services: TechRadarService[] }> = ({ services }) => (
  <MapView
    style={styles.map}
    initialRegion={MANAGUA_REGION}
    scrollEnabled
    zoomEnabled
  >
    {services.map((service) => (
      <Marker
        key={service.id}
        coordinate={{ latitude: service.latitude, longitude: service.longitude }}
        title={service.title}
        pinColor="#5AC8FA"
      />
    ))}
  </MapView>
);

const ServiceCard: React.FC<{
  service: TechRadarService;
  onDetails?: (service: TechRadarService) => void;
}> = ({ service, onDetails }) => (
  <Card style={styles.jobCard} elevated>
    <Text style={styles.jobTitle} numberOfLines={2}>
      {service.title}
    </Text>
    <View style={styles.jobMetaRow}>
      <Text style={styles.jobDistance}>{service.distance}</Text>
      <Text style={styles.jobPrice}>{service.price}</Text>
    </View>
    <TouchableOpacity
      style={styles.detailsBtn}
      activeOpacity={0.82}
      onPress={() => onDetails?.(service)}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalles de ${service.title}`}
    >
      <Text style={styles.detailsBtnText}>Ver Detalles</Text>
    </TouchableOpacity>
  </Card>
);

export const TechServiceRadar: React.FC<TechServiceRadarProps> = ({ onServiceDetails }) => {
  const [isMapActive, setIsMapActive] = useState(false);

  const handleActivate = useCallback(() => {
    setIsMapActive(true);
  }, []);

  const renderServiceCard: ListRenderItem<TechRadarService> = useCallback(
    ({ item }) => (
      <ServiceCard service={item} onDetails={onServiceDetails} />
    ),
    [onServiceDetails],
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.radarShell}>
        {isMapActive ? (
          <TechServiceRadarMap services={MOCK_RADAR_SERVICES} />
        ) : (
          <View style={styles.inactiveLayer}>
            <TouchableOpacity
              style={styles.activateBtn}
              activeOpacity={0.85}
              onPress={handleActivate}
              accessibilityRole="button"
              accessibilityLabel="Ver servicios cerca"
            >
              <Text style={styles.activateBtnText}>VER SERVICIOS CERCA</Text>
            </TouchableOpacity>
            <Text style={styles.activateHint}>(Toca para activar mapa en vivo)</Text>
          </View>
        )}
      </View>

      {isMapActive && (
        <FlatList
          data={MOCK_RADAR_SERVICES}
          keyExtractor={(item) => item.id}
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
  },
  activateHint: {
    marginTop: 10,
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
  },
  map: {
    width: '100%',
    height: RADAR_HEIGHT,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  jobDistance: {
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
