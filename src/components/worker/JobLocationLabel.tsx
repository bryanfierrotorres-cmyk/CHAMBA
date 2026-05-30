import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { M3, stitchTypography } from '@constants/stitchStyles';
import { parseJobAddress } from '@utils/locationFormat';
import { formatDistance } from '@utils/formatters';

interface JobLocationLabelProps {
  address: string | null | undefined;
  showIcon?: boolean;
  distanceKm?: number | null;
  showDistance?: boolean;
  numberOfLines?: number;
  /** Estilo compacto para tarjetas del feed. */
  compact?: boolean;
}

export const JobLocationLabel: React.FC<JobLocationLabelProps> = ({
  address,
  showIcon = true,
  distanceKm,
  showDistance = false,
  numberOfLines = 2,
  compact = false,
}) => {
  const { department, detail } = parseJobAddress(address);
  const distanceText =
    showDistance && distanceKm != null
      ? ` · A ${formatDistance(distanceKm)} de ti`
      : '';

  if (!department) {
    const fallback = detail || address || 'Ubicación no indicada';
    return (
      <View style={styles.row}>
        {showIcon && (
          <Ionicons name="location-outline" size={compact ? 14 : 16} color={M3.onSurfaceVariant} />
        )}
        <Text
          style={[compact ? stitchTypography.bodySm : styles.detail, styles.flex]}
          numberOfLines={numberOfLines}
        >
          {fallback}
          {distanceText}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {showIcon && (
        <Ionicons name="location-outline" size={compact ? 14 : 16} color={M3.primary} />
      )}
      <Text style={[styles.flex, compact ? styles.compactWrap : styles.wrap]} numberOfLines={numberOfLines}>
        <Text style={styles.department}>{department}</Text>
        {detail ? <Text style={compact ? stitchTypography.bodySm : styles.detail}>{` · ${detail}`}</Text> : null}
        {distanceText ? <Text style={styles.distance}>{distanceText}</Text> : null}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    flex: 1,
  },
  flex: { flex: 1 },
  wrap: { lineHeight: 22 },
  compactWrap: { lineHeight: 18 },
  department: {
    fontWeight: '800',
    color: M3.onBackground,
    fontSize: 14,
  },
  detail: {
    color: M3.onSurfaceVariant,
    fontSize: 14,
  },
  distance: {
    color: M3.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
