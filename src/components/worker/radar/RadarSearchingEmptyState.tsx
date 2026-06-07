import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RadarPulseAnimation } from './RadarPulseAnimation';
import { RADAR_DEEP_BLUE, RADAR_MUTED, RADAR_TITLE } from './radarTheme';

interface RadarSearchingEmptyStateProps {
  /** Texto secundario opcional (ej. filtro de categoría activo). */
  hint?: string;
}

export const RadarSearchingEmptyState: React.FC<RadarSearchingEmptyStateProps> = ({ hint }) => (
  <View style={styles.wrap}>
    <RadarPulseAnimation />
    <Text style={styles.title}>Buscando nuevas chambas en la zona...</Text>
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    <View style={styles.liveRow}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>En línea y buscando clientes...</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: RADAR_TITLE,
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  hint: {
    fontSize: 14,
    color: RADAR_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    flexShrink: 0,
  },
  liveText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: RADAR_DEEP_BLUE,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
