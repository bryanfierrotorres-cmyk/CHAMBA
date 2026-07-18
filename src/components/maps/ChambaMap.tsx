/**
 * Mapa nativo (iOS/Android) — MapLibre + teselas gratis de OpenFreeMap.
 * Reemplaza a react-native-maps/Google Maps: sin API key, sin facturación,
 * mismo look-and-feel en toda la app. Ver también ChambaMap.web.tsx (Metro
 * resuelve la variante correcta según plataforma automáticamente).
 */
import React, { useMemo } from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';

// OpenFreeMap no requiere token — MapLibre igual pide desactivar explícitamente
// la validación de token de Mapbox (que no usamos).
MapLibreGL.setAccessToken(null);

export const CHAMBA_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const MANAGUA: [number, number] = [-86.2514, 12.1364];

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
  /** Desplaza el centro proyectado hacia abajo (px) sin mover la coordenada central. */
  centerOffsetY?: number;
  children?: React.ReactNode;
}

interface MarkerProps {
  id?: string;
  coordinate?: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  anchor?: { x: number; y: number };
  children?: React.ReactElement;
}

const EMPTY_MARKER = <></>;

const regionToZoom = (latitudeDelta?: number): number => {
  if (!latitudeDelta || latitudeDelta <= 0) return 12;
  return Math.max(3, Math.min(18, Math.log2(360 / latitudeDelta)));
};

export const MapView: React.FC<MapViewProps> = ({
  style,
  initialRegion,
  scrollEnabled = true,
  zoomEnabled = true,
  centerOffsetY = 0,
  children,
}) => {
  const center: [number, number] = initialRegion
    ? [initialRegion.longitude, initialRegion.latitude]
    : MANAGUA;
  const zoom = regionToZoom(initialRegion?.latitudeDelta);
  // padding.top = 2*offset baja el centro proyectado ~offset px (misma lógica que web).
  const padding = centerOffsetY
    ? { paddingTop: Math.max(0, centerOffsetY) * 2, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 }
    : undefined;

  return (
    <MapLibreGL.MapView
      style={style}
      mapStyle={CHAMBA_MAP_STYLE_URL}
      scrollEnabled={scrollEnabled}
      zoomEnabled={zoomEnabled}
      pitchEnabled={false}
      rotateEnabled={false}
      logoEnabled={false}
      compassEnabled={false}
      attributionEnabled
    >
      <MapLibreGL.Camera
        centerCoordinate={center}
        zoomLevel={zoom}
        padding={padding}
        animationMode="moveTo"
        animationDuration={0}
      />
      {children}
    </MapLibreGL.MapView>
  );
};

let anonMarkerSeq = 0;

/** Marcador con vista custom (misma idea que react-native-maps: children = pin visual). */
export const Marker: React.FC<MarkerProps> = ({
  id,
  coordinate,
  anchor,
  children,
}) => {
  const stableId = useMemo(
    () => id ?? `chamba-marker-${++anonMarkerSeq}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  if (!coordinate) return null;

  return (
    <MapLibreGL.PointAnnotation
      id={stableId}
      coordinate={[coordinate.longitude, coordinate.latitude]}
      anchor={anchor}
    >
      {children ?? EMPTY_MARKER}
    </MapLibreGL.PointAnnotation>
  );
};

export default MapView;
