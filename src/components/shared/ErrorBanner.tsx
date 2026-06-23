import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { M3, SPACING, BORDER_RADIUS } from '@constants/stitchStyles';
import { useError } from '@context/ErrorContext';

export const ErrorBanner: React.FC = () => {
  const { error, setError } = useError();

  if (!error) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.message}>{error}</Text>
      <TouchableOpacity onPress={() => setError(null)} style={styles.closeButton}>
        <Text style={styles.closeLabel}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 0 : 20,
    left: 0,
    right: 0,
    backgroundColor: M3.error,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
  },
  message: {
    color: M3.onError,
    flex: 1,
    fontSize: 14,
  },
  closeButton: {
    marginLeft: SPACING.sm,
  },
  closeLabel: {
    color: M3.onError,
    fontSize: 18,
    fontWeight: '600',
  },
});
