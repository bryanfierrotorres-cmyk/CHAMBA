import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Switch, Platform } from 'react-native';
import { Avatar } from '@components/Avatar';
import {
  RADAR_BORDER,
  RADAR_DEEP_BLUE,
  RADAR_FLOAT_BG,
  RADAR_MUTED,
  RADAR_TITLE,
} from './radarTheme';

interface FloatingRadarHeaderProps {
  avatarUri?: string | null;
  fullName?: string | null;
  isOnline: boolean;
  /** Si se provee, muestra un switch interactivo en vez del badge pasivo. */
  onToggleOnline?: (next: boolean) => void;
  isToggling?: boolean;
}

/** Fila de saludo + estado — se posiciona externamente (ver RadarTopPanel). */
export const FloatingRadarHeader: React.FC<FloatingRadarHeaderProps> = ({
  avatarUri,
  fullName,
  isOnline,
  onToggleOnline,
  isToggling,
}) => {
  const displayName = fullName?.trim() || 'Técnico';
  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length === 0) return 'TC';
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'TC';
  }, [displayName]);

  return (
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

        {onToggleOnline ? (
          <View style={[styles.toggleBadge, !isOnline && styles.toggleBadgeOffline]}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleTitle, !isOnline && styles.toggleTitleOffline]} numberOfLines={1}>
                {isOnline ? 'Disponible' : 'Sin conexión'}
              </Text>
              <Text style={[styles.toggleSub, !isOnline && styles.toggleSubOffline]} numberOfLines={1}>
                {isOnline ? 'Recibiendo solicitudes' : 'Activá para buscar'}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={onToggleOnline}
              disabled={isToggling}
              trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
              thumbColor={Platform.OS === 'android' ? (isOnline ? '#16A34A' : '#F3F4F6') : undefined}
              ios_backgroundColor="#D1D5DB"
            />
          </View>
        ) : (
          <View style={[styles.statusBadge, !isOnline && styles.statusBadgeOffline]}>
            <Text style={styles.statusDot}>{isOnline ? '🟢' : '⚪️'}</Text>
            <Text style={[styles.statusText, !isOnline && styles.statusTextOffline]} numberOfLines={2}>
              {isOnline ? 'Buscando chambas…' : 'Fuera de línea'}
            </Text>
          </View>
        )}
      </View>
  );
};

const styles = StyleSheet.create({
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
  toggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    flexShrink: 0,
  },
  toggleBadgeOffline: {
    backgroundColor: '#F3F4F6',
    borderColor: RADAR_BORDER,
  },
  toggleTextCol: {
    alignItems: 'flex-end',
  },
  toggleTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  toggleTitleOffline: {
    color: RADAR_MUTED,
  },
  toggleSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#16A34A',
    marginTop: 1,
  },
  toggleSubOffline: {
    color: RADAR_MUTED,
  },
});
