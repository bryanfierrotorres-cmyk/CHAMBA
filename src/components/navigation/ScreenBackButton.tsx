import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_STEP_SHADOW, CHAMBA, TOUCH_TARGET_MIN } from '@constants/chambaUI';

interface ScreenBackButtonProps {
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
  label?: string;
}

/** Botón atrás visible — esquina superior, área táctil 48px, alto contraste. */
export const ScreenBackButton: React.FC<ScreenBackButtonProps> = ({
  onPress,
  color = CHAMBA.navy,
  style,
  label = 'Atrás',
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.btn, style]}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    accessibilityRole="button"
    accessibilityLabel={label}
    activeOpacity={0.82}
  >
    <Ionicons name="chevron-back" size={26} color={color} />
    <Text style={[styles.label, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: TOUCH_TARGET_MIN,
    minHeight: TOUCH_TARGET_MIN,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'flex-start',
    backgroundColor: CHAMBA.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CHAMBA.border,
    ...CARD_STEP_SHADOW,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
