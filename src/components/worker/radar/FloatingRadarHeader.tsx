import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '@components/Avatar';
import {
  RADAR_BORDER,
  RADAR_DEEP_BLUE,
  RADAR_FLOAT_BG,
  RADAR_HORIZONTAL,
  RADAR_MUTED,
  RADAR_TITLE,
} from './radarTheme';

interface FloatingRadarHeaderProps {
  topInset: number;
  avatarUri?: string | null;
  fullName?: string | null;
  isOnline: boolean;
}

export const FloatingRadarHeader: React.FC<FloatingRadarHeaderProps> = ({
  topInset,
  avatarUri,
  fullName,
  isOnline,
}) => {
  const displayName = fullName?.trim() || 'Técnico';
  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length === 0) return 'TC';
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'TC';
  }, [displayName]);

  return (
    <View style={[styles.wrap, { top: topInset + 8 }]}>
      <View style={styles.card}>
        <View style={styles.left}>
          {avatarUri ? (
            <Avatar uri={avatarUri} name={displayName} size={40} />
          ) : (
            <View style={styles.initialsOrb}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          )}
          <View style={styles.nameBlock}>
            <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">
              {`Hola, ${displayName}`}
            </Text>
            <Text style={styles.sub}>Radar de solicitudes</Text>
          </View>
        </View>

        <View style={[styles.statusBadge, !isOnline && styles.statusBadgeOffline]}>
          <Text style={styles.statusDot}>{isOnline ? '🟢' : '⚪️'}</Text>
          <Text style={[styles.statusText, !isOnline && styles.statusTextOffline]} numberOfLines={2}>
            {isOnline ? 'Buscando chambas…' : 'Fuera de línea'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: RADAR_HORIZONTAL,
    right: RADAR_HORIZONTAL,
    zIndex: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: RADAR_FLOAT_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  initialsOrb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RADAR_DEEP_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '700',
    color: RADAR_TITLE,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  sub: {
    fontSize: 11,
    fontWeight: '500',
    color: RADAR_MUTED,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 132,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
  },
  statusBadgeOffline: {
    backgroundColor: '#F3F4F6',
  },
  statusDot: {
    fontSize: 10,
    lineHeight: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: RADAR_DEEP_BLUE,
    lineHeight: 14,
  },
  statusTextOffline: {
    color: RADAR_MUTED,
    fontWeight: '600',
  },
});
