import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CHAMBA } from '@constants/chambaUI';
import { formatCurrency, formatDistance } from '@utils/formatters';
import { parseJobAddress } from '@utils/locationFormat';
import { normalizeUrgencyLevel } from '@utils/jobScheduling';
import { RADAR_BORDER } from './radarTheme';
import type { Job, UrgencyLevel } from '@/types';

const EARN_GREEN = '#15803D';
const URGENT_AMBER = '#B45309';
const ICON_BTN_INFO = 28;
const ICON_BTN_DISMISS = 28;
const ICON_BTN_APPLY = 42;

/** Ventana de visibilidad en radar — genera urgencia sin bloquear flujo real. */
const RADAR_WINDOW_MS: Record<UrgencyLevel, number> = {
  hoy: 20 * 60 * 1000,
  manana: 45 * 60 * 1000,
  programado: 60 * 60 * 1000,
};

type HitSlopInsets = { top: number; bottom: number; left: number; right: number };

const HIT_SLOP_INFO: HitSlopInsets = { top: 10, bottom: 10, left: 10, right: 4 };
const HIT_SLOP_DISMISS: HitSlopInsets = { top: 10, bottom: 10, left: 8, right: 2 };
const HIT_SLOP_APPLY: HitSlopInsets = { top: 12, bottom: 12, left: 16, right: 10 };

export interface CompactJobCardProps {
  job: Job;
  onPressDetail: () => void;
  onDismiss?: () => void;
  onAccept?: () => void | Promise<void>;
  canDismiss?: boolean;
  canAccept?: boolean;
  isAccepting?: boolean;
  awaitingClientChoice?: boolean;
  isAccepted?: boolean;
  acceptBlocked?: boolean;
}

const isTestLocationLabel = (value: string): boolean =>
  /pin\s*prueba|prueba\s*\d|test\s*pin/i.test(value);

/** Contexto accionable: proximidad + urgencia, sin ruido de pruebas. */
const buildContextLine = (job: Job): string => {
  const parts: string[] = [];
  const urgency = normalizeUrgencyLevel(job.urgency_level);

  if (job.location?.distance_km != null) {
    parts.push(`A ${formatDistance(job.location.distance_km)} de tu posición`);
  }

  if (urgency === 'hoy') {
    parts.push('Servicio urgente');
  } else if (urgency === 'manana') {
    parts.push('Para mañana');
  }

  if (parts.length === 0) {
    const { department, detail } = parseJobAddress(job.location?.address);
    const candidate = detail || department || job.location?.address?.trim() || '';
    if (candidate && !isTestLocationLabel(candidate)) {
      parts.push(candidate);
    } else if (department) {
      parts.push(department);
    }
  }

  return parts.join(' · ') || 'Ubicación por confirmar';
};

const getRadarUrgency = (job: Job) => {
  const urgency = normalizeUrgencyLevel(job.urgency_level);
  const windowMs = RADAR_WINDOW_MS[urgency];
  const createdMs = new Date(job.created_at).getTime();
  const expiresAt = createdMs + windowMs;
  const remainingMs = Math.max(0, expiresAt - Date.now());
  const remainingMin = Math.max(1, Math.ceil(remainingMs / 60_000));
  const progress = Math.max(0, Math.min(1, remainingMs / windowMs));
  const isCritical = remainingMin <= 8;

  let label: string;
  if (remainingMs <= 0) {
    label = 'Último momento';
  } else if (remainingMin === 1) {
    label = 'Expira en 1 min';
  } else {
    label = `Expira en ${remainingMin} min`;
  }

  return { label, progress, isCritical, showBar: job.status === 'open' };
};

interface IconActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'neutral' | 'ghost' | 'apply';
  size?: number;
  iconSize?: number;
  loading?: boolean;
  hitSlop?: HitSlopInsets;
  accessibilityLabel: string;
}

const IconAction: React.FC<IconActionProps> = ({
  icon,
  onPress,
  disabled,
  variant = 'neutral',
  size = ICON_BTN_INFO,
  iconSize = 15,
  loading,
  hitSlop = HIT_SLOP_INFO,
  accessibilityLabel,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || loading || !onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    style={({ pressed }) => [
      styles.iconBtn,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
      },
      variant === 'ghost' && styles.iconBtnGhost,
      variant === 'apply' && styles.iconBtnApply,
      variant === 'neutral' && styles.iconBtnNeutral,
      (disabled || !onPress) && styles.iconBtnDisabled,
      pressed && !disabled && onPress && styles.iconBtnPressed,
    ]}
    hitSlop={hitSlop}
  >
    {loading ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
    ) : (
      <Ionicons
        name={icon}
        size={iconSize}
        color={
          variant === 'apply'
            ? '#FFFFFF'
            : variant === 'ghost'
              ? '#9CA3AF'
              : CHAMBA.primary
        }
      />
    )}
  </Pressable>
);

export const CompactJobCard: React.FC<CompactJobCardProps> = ({
  job,
  onPressDetail,
  onDismiss,
  onAccept,
  canDismiss = false,
  canAccept = false,
  isAccepting = false,
  awaitingClientChoice = false,
  isAccepted = false,
  acceptBlocked = false,
}) => {
  const price = formatCurrency(job.worker_payout || job.pay_amount);
  const contextLine = buildContextLine(job);
  const urgency = useMemo(() => getRadarUrgency(job), [job.created_at, job.status, job.urgency_level]);

  const statusLine = awaitingClientChoice
    ? 'Postulación enviada — esperando cliente'
    : isAccepted
      ? 'Chamba asignada'
      : contextLine;

  const acceptDisabled =
    !canAccept
    || acceptBlocked
    || isAccepting
    || awaitingClientChoice
    || isAccepted
    || job.status !== 'open';

  const acceptIcon: keyof typeof Ionicons.glyphMap = awaitingClientChoice
    ? 'hourglass-outline'
    : isAccepted
      ? 'checkmark'
      : 'flash';

  const showUrgency = !awaitingClientChoice && !isAccepted && urgency.showBar;

  return (
    <View style={styles.card}>
      <View style={styles.infoCol}>
        <Text style={styles.title} numberOfLines={1}>
          {job.title?.trim() || 'Solicitud'}
        </Text>
        <Text
          style={[
            styles.subtitle,
            normalizeUrgencyLevel(job.urgency_level) === 'hoy' && !isAccepted && styles.subtitleUrgent,
          ]}
          numberOfLines={1}
        >
          {statusLine}
        </Text>
      </View>

      <View style={styles.rightCol}>
        <View style={styles.priceRow}>
          <Text style={styles.price} numberOfLines={1}>
            {price}
          </Text>
          {showUrgency ? (
            <View style={styles.urgencyBlock}>
              <Text
                style={[styles.urgencyLabel, urgency.isCritical && styles.urgencyLabelCritical]}
                numberOfLines={1}
              >
                {urgency.label}
              </Text>
              <View style={styles.urgencyTrack}>
                <View
                  style={[
                    styles.urgencyFill,
                    { width: `${Math.round(urgency.progress * 100)}%` },
                    urgency.isCritical && styles.urgencyFillCritical,
                  ]}
                />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <IconAction
            icon="information-circle-outline"
            onPress={onPressDetail}
            size={ICON_BTN_INFO}
            hitSlop={HIT_SLOP_INFO}
            accessibilityLabel="Ver detalles de la solicitud"
          />
          <IconAction
            icon="close-outline"
            onPress={canDismiss ? onDismiss : undefined}
            disabled={!canDismiss}
            variant="ghost"
            size={ICON_BTN_DISMISS}
            iconSize={16}
            hitSlop={HIT_SLOP_DISMISS}
            accessibilityLabel="Apartar solicitud del radar"
          />
          <IconAction
            icon={acceptIcon}
            onPress={acceptDisabled ? undefined : onAccept}
            disabled={acceptDisabled}
            variant="apply"
            size={ICON_BTN_APPLY}
            iconSize={22}
            loading={isAccepting}
            hitSlop={HIT_SLOP_APPLY}
            accessibilityLabel="Postular ahora a la solicitud"
          />
        </View>
      </View>
    </View>
  );
};

/** Altura aproximada de una fila compacta (para snap del sheet). */
export const COMPACT_JOB_CARD_HEIGHT = 84;
export const COMPACT_JOB_CARD_GAP = 6;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: COMPACT_JOB_CARD_HEIGHT,
    maxHeight: 88,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.15,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: CHAMBA.muted,
    lineHeight: 14,
  },
  subtitleUrgent: {
    color: URGENT_AMBER,
    fontWeight: '600',
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 5,
  },
  priceRow: {
    alignItems: 'flex-end',
    gap: 3,
  },
  price: {
    fontSize: 13,
    fontWeight: '800',
    color: EARN_GREEN,
    letterSpacing: -0.2,
  },
  urgencyBlock: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 88,
  },
  urgencyLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  urgencyLabelCritical: {
    color: URGENT_AMBER,
  },
  urgencyTrack: {
    width: 72,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  urgencyFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: CHAMBA.primary,
  },
  urgencyFillCritical: {
    backgroundColor: URGENT_AMBER,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnNeutral: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: RADAR_BORDER,
  },
  iconBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconBtnApply: {
    backgroundColor: EARN_GREEN,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: EARN_GREEN,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  iconBtnDisabled: {
    opacity: 0.45,
  },
  iconBtnPressed: {
    opacity: 0.88,
  },
});
