import React from 'react';
import { memo } from 'react';
const _keepReact = React;
import { View, Text, StyleSheet } from 'react-native';
import { useLiveWorkerData } from '../../hooks/useLiveWorkerData';
import { M3, SPACING } from '@constants/stitchStyles';

// This component isolates dynamic telemetry to prevent re-rendering the static parent
const LiveTelemetryOverlayComponent: React.FC = () => {
  const { isOnline } = useLiveWorkerData();

  if (!isOnline) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.dot} />
      <Text style={styles.text}>En Línea</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    // 52 (no 16) para no solaparse con el badge "DEMO" (misma esquina, z-index mayor).
    top: 52,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: M3.primary, // Or green if prefered
  },
  text: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

export const LiveTelemetryOverlay = memo(LiveTelemetryOverlayComponent);
