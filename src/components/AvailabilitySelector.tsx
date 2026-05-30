import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  Animated, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/theme';
import type { AvailabilityStatus } from '@/types';

// ─── Config per status ────────────────────────────────────────────

interface StatusConfig {
  label:    string;
  icon:     keyof typeof Ionicons.glyphMap;
  color:    string;
  bg:       string;
  border:   string;
  activeBg: string;
}

export const AVAILABILITY_CONFIG: Record<AvailabilityStatus, StatusConfig> = {
  available: {
    label:    'Disponible',
    icon:     'checkmark-circle',
    color:    '#166534',
    bg:       '#F0FDF4',
    border:   '#86EFAC',
    activeBg: '#DCFCE7',
  },
  busy: {
    label:    'Ocupado',
    icon:     'time',
    color:    '#92400E',
    bg:       '#FFFBEB',
    border:   '#FDE68A',
    activeBg: '#FEF3C7',
  },
  offline: {
    label:    'Offline',
    icon:     'moon',
    color:    COLORS.text.secondary,
    bg:       COLORS.bg.elevated,
    border:   COLORS.border.default,
    activeBg: COLORS.bg.elevated,
  },
};

// ─── Dot indicator ───────────────────────────────────────────────

interface AvailabilityDotProps {
  status: AvailabilityStatus;
  size?:  number;
  pulse?: boolean;
}

export const AvailabilityDot: React.FC<AvailabilityDotProps> = ({
  status,
  size = 10,
  pulse = false,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cfg = AVAILABILITY_CONFIG[status];

  useEffect(() => {
    if (pulse && status === 'available') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulse]);

  return (
    <View style={{ width: size + 6, height: size + 6, alignItems: 'center', justifyContent: 'center' }}>
      {pulse && status === 'available' && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: cfg.color,
            opacity: 0.35,
            transform: [{ scale: pulseAnim }],
          }}
        />
      )}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: cfg.color,
        }}
      />
    </View>
  );
};

// ─── Inline badge (para el tab bar, cards, etc.) ─────────────────

export const AvailabilityBadge: React.FC<{ status: AvailabilityStatus }> = ({ status }) => {
  const cfg = AVAILABILITY_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <AvailabilityDot status={status} size={7} pulse={status === 'available'} />
      <Text style={[styles.badgeLabel, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

// ─── 3-state selector (para la pantalla de perfil) ───────────────

interface AvailabilitySelectorProps {
  current:    AvailabilityStatus;
  onChange:   (status: AvailabilityStatus) => void;
  isLoading?: boolean;
  disabled?:  boolean;
}

const OPTIONS: AvailabilityStatus[] = ['available', 'busy', 'offline'];

export const AvailabilitySelector: React.FC<AvailabilitySelectorProps> = ({
  current,
  onChange,
  isLoading = false,
  disabled = false,
}) => (
  <View style={styles.selectorWrap}>
    <View style={styles.selectorHeader}>
      <Text style={styles.selectorTitle}>Disponibilidad</Text>
      {isLoading && (
        <ActivityIndicator size="small" color={COLORS.brand[500]} />
      )}
    </View>

    <View style={styles.optionsRow}>
      {OPTIONS.map((status) => {
        const cfg      = AVAILABILITY_CONFIG[status];
        const selected = current === status;

        return (
          <TouchableOpacity
            key={status}
            onPress={() => !disabled && !isLoading && onChange(status)}
            activeOpacity={0.75}
            disabled={disabled || isLoading}
            style={[
              styles.option,
              { borderColor: selected ? cfg.border : COLORS.border.subtle },
              selected && { backgroundColor: cfg.activeBg },
            ]}
          >
            {/* Icon */}
            <View
              style={[
                styles.optionIconWrap,
                { backgroundColor: selected ? cfg.bg : COLORS.bg.elevated },
              ]}
            >
              <Ionicons
                name={cfg.icon}
                size={22}
                color={selected ? cfg.color : COLORS.text.muted}
              />
            </View>

            {/* Label */}
            <Text
              style={[
                styles.optionLabel,
                { color: selected ? cfg.color : COLORS.text.secondary },
                selected && { fontWeight: '700' },
              ]}
            >
              {cfg.label}
            </Text>

            {/* Active dot */}
            {selected && (
              <AvailabilityDot
                status={status}
                size={8}
                pulse={status === 'available'}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Badge
  badge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   3,
    borderRadius:   BORDER_RADIUS.full,
    borderWidth:    1,
    alignSelf:      'flex-start',
  },
  badgeLabel: {
    fontSize:   FONT_SIZE.xs,
    fontWeight: '600',
  },
  // Selector
  selectorWrap: {
    backgroundColor: COLORS.bg.card,
    borderRadius:    BORDER_RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.border.subtle,
    padding:         SPACING.md,
  },
  selectorHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACING.md,
  },
  selectorTitle: {
    color:      COLORS.text.muted,
    fontSize:   FONT_SIZE.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap:           SPACING.xs,
  },
  option: {
    flex:           1,
    borderRadius:   BORDER_RADIUS.md,
    borderWidth:    1.5,
    borderColor:    COLORS.border.subtle,
    padding:        SPACING.sm,
    alignItems:     'center',
    gap:            SPACING.xs,
    backgroundColor: COLORS.bg.input,
  },
  optionIconWrap: {
    width:        44,
    height:       44,
    borderRadius: 12,
    alignItems:   'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize:  FONT_SIZE.xs,
    textAlign: 'center',
    fontWeight: '500',
  },
});
