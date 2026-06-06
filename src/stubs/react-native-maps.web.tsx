/**
 * Web implementation for react-native-maps using Google Maps JavaScript API.
 * Requires the Maps script in web/index.html.
 */
import React, { useEffect, useRef, useState, isValidElement, Children } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  buildChambaMapMarkerIconUrl,
  CHAMBA_MAP_MARKER_SIZE,
} from '@components/maps/mapMarkerWebIcon';

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface MapViewProps {
  style?: object;
  initialRegion?: Region;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  children?: React.ReactNode;
}

interface MarkerProps {
  coordinate?: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string;
  categorySlug?: string;
  children?: React.ReactNode;
}

declare global {
  interface Window {
    google?: {
      maps: typeof google.maps;
    };
  }
}

const regionToZoom = (latitudeDelta?: number): number => {
  if (!latitudeDelta || latitudeDelta <= 0) return 12;
  return Math.max(4, Math.min(18, Math.round(Math.log2(360 / latitudeDelta))));
};

const waitForGoogleMaps = (): Promise<typeof google.maps> =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('window unavailable'));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.maps) {
        window.clearInterval(timer);
        resolve(window.google.maps);
        return;
      }
      if (Date.now() - started > 20_000) {
        window.clearInterval(timer);
        reject(new Error('Google Maps script did not load'));
      }
    }, 120);
  });

const collectMarkerProps = (children: React.ReactNode): MarkerProps[] => {
  const markers: MarkerProps[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<MarkerProps>(child)) return;

    if (child.type === Marker) {
      if (!child.props.coordinate) return;
      markers.push(child.props);
      return;
    }

    if ((child.type as { displayName?: string })?.displayName === 'ChambaMapMarker') {
      const props = child.props as MarkerProps;
      if (!props.coordinate) return;
      markers.push({
        coordinate: props.coordinate,
        title: props.title,
        description: props.description,
        categorySlug: props.categorySlug,
      });
    }
  });
  return markers;
};

export const Marker: React.FC<MarkerProps> = () => null;

export const MapView: React.FC<MapViewProps> = ({
  style,
  initialRegion,
  children,
  scrollEnabled = true,
  zoomEnabled = true,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void waitForGoogleMaps()
      .then((maps) => {
        if (cancelled || !hostRef.current) return;

        const center = initialRegion
          ? { lat: initialRegion.latitude, lng: initialRegion.longitude }
          : { lat: 12.1364, lng: -86.2514 };

        mapRef.current = new maps.Map(hostRef.current, {
          center,
          zoom: regionToZoom(initialRegion?.latitudeDelta),
          gestureHandling: scrollEnabled ? 'auto' : 'none',
          zoomControl: zoomEnabled,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    };
  }, [initialRegion, scrollEnabled, zoomEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadError) return;

    void waitForGoogleMaps().then((maps) => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = collectMarkerProps(children).map((props) => {
        const position = {
          lat: props.coordinate!.latitude,
          lng: props.coordinate!.longitude,
        };
        const iconUrl = buildChambaMapMarkerIconUrl(props.categorySlug);
        return new maps.Marker({
          map,
          position,
          title: props.title,
          icon: {
            url: iconUrl,
            scaledSize: new maps.Size(
              CHAMBA_MAP_MARKER_SIZE.width,
              CHAMBA_MAP_MARKER_SIZE.height,
            ),
            anchor: new maps.Point(
              CHAMBA_MAP_MARKER_SIZE.width / 2,
              CHAMBA_MAP_MARKER_SIZE.height,
            ),
          },
        });
      });
    });
  }, [children, loadError]);

  return (
    <View style={[styles.container, style]}>
      <div
        ref={hostRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 120,
        }}
      />
      {loadError && (
        <View style={styles.fallback} pointerEvents="none">
          <Text style={styles.icon}>🗺️</Text>
          <Text style={styles.label}>Mapa no disponible en web</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 32, marginBottom: 6 },
  label: { color: '#636366', fontSize: 12 },
});

export default MapView;
