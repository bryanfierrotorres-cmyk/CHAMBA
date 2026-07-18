import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from './ChambaMap';
import { Ionicons } from '@expo/vector-icons';
import { renderServiceIconBySlug } from '@constants/clientHomeServiceIcons';
import { CHAMBA_MAP_DEEP_BLUE } from './mapMarkerWebIcon';

const BUBBLE_SIZE = 44;
const ICON_SIZE = 20;
const POINTER_HEIGHT = 9;
const POINTER_HALF_WIDTH = 7;

export const MAP_MARKER_ANCHOR = { x: 0.5, y: 1 } as const;

interface ChambaMapMarkerPinProps {
  categorySlug?: string;
}

/** Pin visual premium (burbuja + icono + punta). */
export const ChambaMapMarkerPin: React.FC<ChambaMapMarkerPinProps> = ({ categorySlug }) => {
  const icon = useMemo(() => {
    const slug = categorySlug?.trim() || 'limpieza_sofas';
    const rendered = renderServiceIconBySlug(slug);
    if (React.isValidElement(rendered)) {
      return React.cloneElement(
        rendered as React.ReactElement<{ size?: number; color?: string }>,
        { size: ICON_SIZE, color: '#FFFFFF' },
      );
    }
    return <Ionicons name="briefcase-outline" size={ICON_SIZE} color="#FFFFFF" />;
  }, [categorySlug]);

  return (
    <View style={styles.wrap} collapsable={false}>
      <View style={styles.bubble}>{icon}</View>
      <View style={styles.pointer} />
    </View>
  );
};

export interface ChambaMapMarkerProps {
  id?: string;
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  categorySlug?: string;
}

/** Marcador de mapa corporativo con icono de servicio y ancla en la punta. */
export const ChambaMapMarker: React.FC<ChambaMapMarkerProps> = ({
  id,
  coordinate,
  title,
  description,
  categorySlug,
}) => (
  <Marker
    id={id}
    coordinate={coordinate}
    title={title}
    anchor={MAP_MARKER_ANCHOR}
    {...({ description, categorySlug } as Record<string, unknown>)}
  >
    <ChambaMapMarkerPin categorySlug={categorySlug} />
  </Marker>
);

ChambaMapMarker.displayName = 'ChambaMapMarker';

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: BUBBLE_SIZE,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: CHAMBA_MAP_DEEP_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 8,
  },
  pointer: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: POINTER_HALF_WIDTH,
    borderRightWidth: POINTER_HALF_WIDTH,
    borderTopWidth: POINTER_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: CHAMBA_MAP_DEEP_BLUE,
  },
});
