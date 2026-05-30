import React from 'react';
import { Platform, TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { M3, SPACING } from '@constants/stitchStyles';

interface ScreenBackButtonProps {
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
  label?: string;
}

/** Botón atrás visible en web móvil (gesto del navegador + UI explícita). */
export const ScreenBackButton: React.FC<ScreenBackButtonProps> = ({
  onPress,
  color = M3.onBackground,
  style,
  label = 'Atrás',
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.btn, style]}
    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Ionicons name="arrow-back" size={22} color={color} />
    {Platform.OS === 'web' ? (
      <Text style={[styles.label, { color }]}>{label}</Text>
    ) : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minWidth: Platform.OS === 'web' ? 72 : 40,
    minHeight: 44,
    justifyContent: 'flex-start',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});
