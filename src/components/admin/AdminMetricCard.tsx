import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { MaterialSymbol } from './MaterialSymbol';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';

interface AdminMetricCardProps {
  icon: string;
  label: string;
  value: string;
  accent?: string;
  wide?: boolean;
  style?: ViewStyle;
}

export const AdminMetricCard: React.FC<AdminMetricCardProps> = ({
  icon,
  label,
  value,
  accent = '#007AFF',
  wide = false,
  style,
}) => (
  <View style={[styles.card, wide && styles.cardWide, style]}>
    <View style={styles.content}>
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </View>
    <View style={[styles.iconCircle, { backgroundColor: accent }]}>
      <MaterialSymbol name={icon} size={22} color="#FFF" filled />
    </View>
  </View>
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
