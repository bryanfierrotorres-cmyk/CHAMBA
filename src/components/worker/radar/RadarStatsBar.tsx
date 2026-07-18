import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@utils/formatters';
import { RADAR_BORDER, RADAR_MUTED, RADAR_TITLE } from './radarTheme';

interface RadarStatsBarProps {
  ratingLabel: string;
  earningsTodayCents: number;
  jobsToday: number;
  radiusKm: number;
}

const StatTile: React.FC<{
  icon: React.ReactNode;
  value: string;
  label: string;
}> = ({ icon, value, label }) => (
  <View style={styles.tile}>
    <View style={styles.topRow}>
      {icon}
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
    </View>
    <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
  </View>
);

export const RadarStatsBar: React.FC<RadarStatsBarProps> = ({
  ratingLabel,
  earningsTodayCents,
  jobsToday,
  radiusKm,
}) => (
  <View style={styles.row}>
    <StatTile
      icon={<Ionicons name="star" size={16} color="#F59E0B" />}
      value={ratingLabel}
      label="Reputación"
    />
    <StatTile
      icon={<Ionicons name="cash" size={16} color="#16A34A" />}
      value={formatCurrency(earningsTodayCents).replace(/\.00$/, '')}
      label="Ganancias hoy"
    />
    <StatTile
      icon={<Ionicons name="briefcase" size={16} color="#2563EB" />}
      value={String(jobsToday)}
      label="Trabajos hoy"
    />
    <StatTile
      icon={<Ionicons name="locate" size={16} color="#7C3AED" />}
      value={`${radiusKm} km`}
      label="Radio de búsqueda"
    />
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tileValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: RADAR_TITLE,
    letterSpacing: -0.3,
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: RADAR_MUTED,
    textAlign: 'center',
  },
});
