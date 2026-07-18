import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialSymbol } from './MaterialSymbol';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';

interface AdminMetricCardProps {
  icon: string;
  label: string;
  value: string;
  accent?: string;
  wide?: boolean;
  style?: ViewStyle;
  /** Si se pasa, la tarjeta se vuelve táctil y muestra el detalle accionable detrás del número. */
  onPress?: () => void;
}

export const AdminMetricCard: React.FC<AdminMetricCardProps> = ({
  icon,
  label,
  value,
  accent = '#007AFF',
  wide = false,
  style,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.card, wide && styles.cardWide, style]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.75 : 1}
  >
    <View style={styles.content}>
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </View>
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={[styles.iconCircle, { backgroundColor: accent }]}>
        <MaterialSymbol name={icon} size={22} color="#FFF" filled />
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={14} color={CHAMBA.muted} /> : null}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...CARD_STEP_SHADOW,
  },
  cardWide: { minWidth: '100%' },
  content: { flex: 1, paddingRight: 10, minWidth: 0 },
  value: {
    fontSize: 22,
    fontWeight: '600',
    color: CHAMBA.navy,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '400',
    color: CHAMBA.muted,
    lineHeight: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
