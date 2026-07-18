/**
 * Mapa web — MapLibre GL JS + teselas gratis de OpenFreeMap.
 * Reemplaza al shim anterior de Google Maps JS API (requería script externo,
 * key y facturación). Metro resuelve este archivo automáticamente en web.
 */
import React, { useEffect, useRef, useState, isValidElement, Children } from 'react';
import { View, StyleSheet } from 'react-native';
import maplibregl from 'maplibre-gl';
import {
  buildChambaMapMarkerIconUrl,
  CHAMBA_MAP_MARKER_SIZE,
} from './mapMarkerWebIcon';

export const CHAMBA_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const MANAGUA: [number, number] = [-86.2514, 12.1364];

// maplibre-gl posiciona todo por JS, pero necesita estas reglas base para que
// el canvas y los controles de atribución (requeridos por la licencia de
// OpenStreetMap) se vean bien sin depender de que Metro procese un import CSS.
let cssInjected = false;
const ensureMapLibreCss = () => {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .maplibregl-map { position: relative; overflow: hidden; width: 100%; height: 100%; }
    .maplibregl-canvas-container { position: absolute; inset: 0; }
    .maplibregl-marker { position: absolute; top: 0; left: 0; will-change: transform; }
    .maplibregl-ctrl-bottom-right { position: absolute; right: 0; bottom: 0; }
    .maplibregl-ctrl-attrib { font: 11px sans-serif; background: rgba(255,255,255,0.7); padding: 1px 6px; }
    .maplibregl-ctrl-attrib a { color: rgba(0,0,0,0.65); }
    .maplibregl-ctrl-attrib.maplibregl-compact { padding: 2px; border-radius: 6px; }
  `;
  document.head.appendChild(style);
};

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
  categorySlug?: string;
  children?: React.ReactNode;
}

const regionToZoom = (latitudeDelta?: number): number => {
  if (!latitudeDelta || latitudeDelta <= 0) return 12;
  return Math.max(3, Math.min(18, Math.log2(360 / latitudeDelta)));
};

const collectMarkerProps = (children: React.ReactNode): MarkerProps[] => {
  const markers: MarkerProps[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<MarkerProps>(child)) return;
    const displayName = (child.type as { displayName?: string })?.displayName;
    if (child.type === Marker || displayName === 'ChambaMapMarker') {
      const props = child.props as MarkerProps;
      if (!props.coordinate) return;
      markers.push(props);
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
  centerOffsetY = 0,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  // Capturar la región inicial una sola vez — evita recrear el mapa en cada
  // actualización de pines (mismo criterio que el stub anterior de Google Maps).
  const initialRegionRef = useRef(initialRegion);

  useEffect(() => {
    ensureMapLibreCss();
    if (!hostRef.current) return;
    const reg = initialRegionRef.current;
    const center: [number, number] = reg ? [reg.longitude, reg.latitude] : MANAGUA;

    const map = new maplibregl.Map({
      container: hostRef.current,
      style: CHAMBA_MAP_STYLE_URL,
      center,
      zoom: regionToZoom(reg?.latitudeDelta),
      scrollZoom: zoomEnabled,
      dragPan: scrollEnabled,
      doubleClickZoom: zoomEnabled,
      touchZoomRotate: zoomEnabled,
      boxZoom: false,
      keyboard: false,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on('load', () => setMapReady(true));

    return () => {
      setMapReady(false);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollEnabled, zoomEnabled]);

  // Reposiciona la cámara cuando cambia la región (radio / ubicación del técnico).
  // El técnico no puede mover el mapa manualmente, pero el zoom se ajusta solo.
  // El padding.top = 2*offset desplaza el centro proyectado ~offset px hacia abajo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !initialRegion) return;
    map.easeTo({
      center: [initialRegion.longitude, initialRegion.latitude],
      zoom: regionToZoom(initialRegion.latitudeDelta),
      padding: { top: Math.max(0, centerOffsetY) * 2, bottom: 0, left: 0, right: 0 },
      duration: 500,
    });
  }, [initialRegion, mapReady, centerOffsetY]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = collectMarkerProps(children).map((props) => {
      const el = document.createElement('div');
      const iconUrl = buildChambaMapMarkerIconUrl(props.categorySlug);
      el.style.width = `${CHAMBA_MAP_MARKER_SIZE.width}px`;
      el.style.height = `${CHAMBA_MAP_MARKER_SIZE.height}px`;
      el.style.backgroundImage = `url("${iconUrl}")`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.cursor = 'default';
      if (props.title) el.title = props.title;

      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([props.coordinate!.longitude, props.coordinate!.latitude])
        .addTo(map);
    });
  }, [children, mapReady]);

  return (
    <View style={[styles.container, style]}>
      <div ref={hostRef} style={{ width: '100%', height: '100%', minHeight: 120 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default MapView;
