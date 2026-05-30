/**
 * Web stub for react-native-maps.
 * Renders a placeholder card so the web build doesn't crash.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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
  children?: React.ReactNode;
}

export const MapView: React.FC<MapViewProps> = ({ style, children }) => (
  <View style={[styles.container, style]}>
    <Text style={styles.icon}>🗺️</Text>
    <Text style={styles.label}>Mapa no disponible en web</Text>
    {children}
  </View>
);

interface MarkerProps {
  coordinate?: { latitude: number; longitude: number };
  title?: string;
  pinColor?: string;
  children?: React.ReactNode;
}

export const Marker: React.FC<MarkerProps> = () => null;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  icon: { fontSize: 32, marginBottom: 6 },
  label: { color: '#636366', fontSize: 12 },
});

export default MapView;
