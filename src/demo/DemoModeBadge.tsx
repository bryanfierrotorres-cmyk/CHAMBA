import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENV } from '@utils/env';

/**
 * DEMO MODE — Distintivo visual global.
 *
 * Overlay fijo (no intercepta toques) para que el desarrollador sepa de un vistazo
 * que la app corre contra el backend en memoria y no contra Supabase.
 * Solo se renderiza cuando ENV.DATA_MODE === 'demo'.
 */
export const DemoModeBadge: React.FC = () => {
  const insets = useSafeAreaInsets();

  if (ENV.DATA_MODE !== 'demo') return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <View style={styles.badge}>
        <View style={styles.dot} />
        <Text style={styles.text}>DEMO</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 10,
    zIndex: 9999,
    elevation: 9999,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#B45309',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FDE68A',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
