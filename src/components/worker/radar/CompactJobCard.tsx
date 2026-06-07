import React from 'react';
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
import { RADAR_BORDER } from './radarTheme';
import type { Job } from '@/types';

const EARN_GREEN = '#15803D';
const ICON_BTN = 32;
const ICON_BTN_PRIMARY = 36;

type HitSlopInsets = { top: number; bottom: number; left: number; right: number };

/** Info: área cómoda sin invadir botones vecinos. */
const HIT_SLOP_INFO: HitSlopInsets = { top: 10, bottom: 10, left: 10, right: 6 };
/** Descartar: generoso arriba/abajo/izq; mínimo hacia postular (derecha). */
const HIT_SLOP_DISMISS: HitSlopInsets = { top: 12, bottom: 12, left: 10, right: 2 };
/** Postular: botón principal — área amplia y separada del ✕. */
const HIT_SLOP_APPLY: HitSlopInsets = { top: 12, bottom: 12, left: 14, right: 10 };

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

const buildLocationSubtitle = (job: Job): string => {
  const { department, detail } = parseJobAddress(job.location?.address);
  if (job.location?.distance_km != null) {
    return `A ${formatDistance(job.location.distance_km)} de ti`;
  }
  if (detail) return detail;
  if (department) return department;
  if (job.location?.address?.trim()) return job.location.address.trim();
  return 'Ubicación por confirmar';
};

interface IconActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'neutral' | 'danger' | 'primary';
  size?: 'md' | 'lg';
  loading?: boolean;
  hitSlop?: HitSlopInsets;
  accessibilityLabel: string;
}

const IconAction: React.FC<IconActionProps> = ({
  icon,
  onPress,
  disabled,
  variant = 'neutral',
  size = 'md',
  loading,
  hitSlop = HIT_SLOP_INFO,
  accessibilityLabel,
}) => {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const dim = size === 'lg' ? ICON_BTN_PRIMARY : ICON_BTN;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading || !onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: dim, height: dim, borderRadius: dim / 2 },
        isPrimary && styles.iconBtnPrimary,
        isDanger && styles.iconBtnDanger,
        (disabled || !onPress) && styles.iconBtnDisabled,
        pressed && !disabled && onPress && styles.iconBtnPressed,
      ]}
      hitSlop={hitSlop}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? '#FFFFFF' : CHAMBA.primary} />
      ) : (
        <Ionicons
          name={icon}
          size={size === 'lg' ? 18 : 16}
          color={
            isPrimary
              ? '#FFFFFF'
              : isDanger
                ? '#DC2626'
                : CHAMBA.primary
          }
        />
      )}
    </Pressable>
  );
};

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
  const subtitle = awaitingClientChoice
    ? 'Postulación enviada — esperando cliente'
    : isAccepted
      ? 'Chamba asignada'
      : buildLocationSubtitle(job);

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
      : 'paper-plane';

  return (
    <View style={styles.card}>
      <View style={styles.infoCol}>
        <Text style={styles.title} numberOfLines={1}>
          {job.title?.trim() || 'Solicitud'}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.rightCol}>
        <Text style={styles.price} numberOfLines={1}>
          {price}
        </Text>
        <View style={styles.actions}>
          <View style={styles.actionsSecondary}>
            <IconAction
              icon="information-circle-outline"
              onPress={onPressDetail}
              hitSlop={HIT_SLOP_INFO}
              accessibilityLabel="Ver detalles de la solicitud"
            />
            <IconAction
              icon="close"
              onPress={canDismiss ? onDismiss : undefined}
              disabled={!canDismiss}
              variant="danger"
              hitSlop={HIT_SLOP_DISMISS}
              accessibilityLabel="Apartar solicitud del radar"
            />
          </View>
          <View style={styles.actionPrimaryWrap}>
            <IconAction
              icon={acceptIcon}
              onPress={acceptDisabled ? undefined : onAccept}
              disabled={acceptDisabled}
              variant="primary"
              size="lg"
              loading={isAccepting}
              hitSlop={HIT_SLOP_APPLY}
              accessibilityLabel="Postular a la solicitud"
            />
          </View>
        </View>
      </View>
    </View>
  );
};

/** Altura aproximada de una fila compacta (para snap del sheet). */
export const COMPACT_JOB_CARD_HEIGHT = 78;
export const COMPACT_JOB_CARD_GAP = 6;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: COMPACT_JOB_CARD_HEIGHT,
    maxHeight: 85,
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
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 4,
  },
  price: {
    fontSize: 13,
    fontWeight: '800',
    color: EARN_GREEN,
    letterSpacing: -0.2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionsSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPrimaryWrap: {
    paddingLeft: 2,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: RADAR_BORDER,
  },
  iconBtnPrimary: {
    backgroundColor: CHAMBA.primary,
    borderColor: CHAMBA.primary,
  },
  iconBtnDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  iconBtnDisabled: {
    opacity: 0.45,
  },
  iconBtnPressed: {
    opacity: 0.88,
  },
});
