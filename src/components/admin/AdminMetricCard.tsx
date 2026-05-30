import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { MaterialSymbol } from './MaterialSymbol';
import { M3, SPACING, CARD_ELEVATION, stitchTypography } from '@constants/stitchStyles';

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
  accent = M3.primary,
  wide = false,
  style,
}) => (
  <View style={[styles.card, wide && styles.cardWide, style]}>
    <View style={[styles.iconWrap, { backgroundColor: accent + '18' }]}>
      <MaterialSymbol name={icon} size={26} color={accent} filled />
    </View>
    <Text style={styles.value} numberOfLines={1}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flex:              1,
    minWidth:          '46%',
    backgroundColor:   M3.surfaceContainerLowest,
    borderRadius:      12,
    padding:           SPACING.md,
    ...CARD_ELEVATION,
  },
  cardWide: {
    minWidth: '100%',
  },
  iconWrap: {
    width:           44,
    height:          44,
    borderRadius:    22,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACING.sm,
  },
  value: {
    ...stitchTypography.displayPrice,
    fontSize:   22,
    lineHeight: 28,
    color:      M3.onBackground,
  },
  label: {
    ...stitchTypography.labelBold,
    marginTop: 4,
    color:     M3.onSurfaceVariant,
  },
});
