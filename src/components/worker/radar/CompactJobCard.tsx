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
import { Avatar } from '@components/Avatar';
import { getConfiguredServiceLabel, getConfiguredServiceSeed } from '@constants/servicesConfig';
import { formatCurrency, formatDistance } from '@utils/formatters';
import { normalizeUrgencyLevel } from '@utils/jobScheduling';
import { RADAR_BORDER } from './radarTheme';
import { RadarJobExpiryTimer } from './RadarJobExpiryTimer';
import type { Job } from '@/types';

const CARD_BLACK = '#111827';
const STAR_GOLD = '#F59E0B';
const CARD_SURFACE = '#F8FAFC';
const CARD_BORDER = '#E2E8F0';

/** Ventana real en radar: 1 hora desde la publicación. */
const RADAR_EXPIRY_MS = 60 * 60 * 1000;

export interface CompactJobCardProps {
  job: Job;
  onPressDetail: () => void;
  onAccept?: () => void | Promise<void>;
  canAccept?: boolean;
  isAccepting?: boolean;
  awaitingClientChoice?: boolean;
  isAccepted?: boolean;
  acceptBlocked?: boolean;
}

const hashToRating = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % 50;
  }
  return (4.5 + (hash % 5) * 0.1).toFixed(1);
};

const getClientDisplay = (job: Job) => {
  const fullName = job.creator?.full_name?.trim();
  return {
    name: fullName || 'Cliente',
    avatarUri: job.creator?.avatar_url ?? null,
  };
};

const estimateTravelMinutes = (distanceKm: number): number =>
  Math.max(3, Math.round(distanceKm * 4.2));

const buildLocationLine = (job: Job): string => {
  const distanceKm = job.location?.distance_km;
  if (distanceKm != null && distanceKm > 0) {
    const travelMin = estimateTravelMinutes(distanceKm);
    return `A ${formatDistance(distanceKm)} · ${travelMin} min de camino`;
  }
  const address = job.location?.address?.trim();
  if (address) return address;
  return 'Ubicación por confirmar';
};

const getRadarExpiryAt = (job: Job): number =>
  new Date(job.created_at).getTime() + RADAR_EXPIRY_MS;

const getRateLabel = (job: Job): string => {
  const seed = getConfiguredServiceSeed(job.category);
  if (seed?.subcategorySlug === 'ac') return 'Instalación';
  if (normalizeUrgencyLevel(job.urgency_level) === 'hoy') return 'Urgente';
  return 'Tarifa fija';
};

interface AcceptButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const AcceptButton: React.FC<AcceptButtonProps> = ({
  onPress,
  disabled,
  loading,
  label,
  icon,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || loading || !onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [
      styles.acceptBtn,
      (disabled || !onPress) && styles.acceptBtnDisabled,
      pressed && !disabled && onPress && styles.acceptBtnPressed,
    ]}
  >
    {loading ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
    ) : (
      <>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
        <Text style={styles.acceptBtnText}>{label}</Text>
      </>
    )}
  </Pressable>
);

export const CompactJobCard = React.memo<CompactJobCardProps>(function CompactJobCard({
  job,
  onPressDetail,
  onAccept,
  canAccept = false,
  isAccepting = false,
  awaitingClientChoice = false,
  isAccepted = false,
  acceptBlocked = false,
}) {
  const price = formatCurrency(job.worker_payout || job.pay_amount);
  const client = useMemo(
    () => getClientDisplay(job),
    [job.creator?.full_name, job.creator?.avatar_url, job.id],
  );
  const rating = useMemo(
    () => hashToRating(job.creator?.id ?? job.created_by ?? job.id),
    [job.created_by, job.creator?.id, job.id],
  );
  const serviceLabel = job.title?.trim() || getConfiguredServiceLabel(job.category) || 'Servicio';
  const serviceIcon = getConfiguredServiceSeed(job.category)?.icon ?? '🔧';
  const locationLine = buildLocationLine(job);
  const rateLabel = getRateLabel(job);
  const expiresAt = useMemo(() => getRadarExpiryAt(job), [job.created_at]);

  const acceptDisabled =
    !canAccept
    || acceptBlocked
    || isAccepting
    || awaitingClientChoice
    || isAccepted
    || job.status !== 'open';

  const acceptLabel = awaitingClientChoice
    ? 'ENVIADA'
    : isAccepted
      ? 'ASIGNADA'
      : 'ACEPTAR';

  const acceptIcon: keyof typeof Ionicons.glyphMap = awaitingClientChoice
    ? 'hourglass-outline'
    : isAccepted
      ? 'checkmark'
      : 'flash';

  const showTimer = !awaitingClientChoice && !isAccepted && job.status === 'open';

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPressDetail}
        accessibilityRole="button"
        accessibilityLabel={`Ver detalle de ${serviceLabel}`}
        style={({ pressed }) => [styles.tappable, pressed && styles.tappablePressed]}
      >
        <View style={styles.headerRow}>
          <View style={styles.clientCol}>
            <Avatar
              uri={client.avatarUri}
              name={job.creator?.full_name?.trim() || client.name}
              size={36}
            />
            <View style={styles.clientMeta}>
              <Text style={styles.clientName} numberOfLines={1}>
                {client.name}
              </Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color={STAR_GOLD} />
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            </View>
          </View>

          <View style={styles.priceCol}>
            <Text style={styles.price} numberOfLines={1}>
              {price}
            </Text>
            <Text style={styles.rateLabel} numberOfLines={1}>
              {rateLabel}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.bodyRow}>
          <Text style={styles.serviceIcon}>{serviceIcon}</Text>
          <View style={styles.bodyTextCol}>
            <Text style={styles.serviceTitle} numberOfLines={1}>
              {serviceLabel}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color="#6B7280" />
              <Text style={styles.locationText} numberOfLines={1}>
                {locationLine}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      <View style={styles.footerRow}>
        {showTimer ? (
          <RadarJobExpiryTimer expiresAt={expiresAt} />
        ) : (
          <Text style={styles.statusFootnote} numberOfLines={1}>
            {awaitingClientChoice
              ? 'Esperando respuesta del cliente'
              : isAccepted
                ? 'Chamba asignada'
                : ''}
          </Text>
        )}

        <AcceptButton
          onPress={acceptDisabled ? undefined : onAccept}
          disabled={acceptDisabled}
          loading={isAccepting}
          label={acceptLabel}
          icon={acceptIcon}
        />
      </View>
    </View>
  );
});

/** Altura aproximada de una fila compacta (para snap del sheet). */
export const COMPACT_JOB_CARD_HEIGHT = 152;
export const COMPACT_JOB_CARD_GAP = 10;

const styles = StyleSheet.create({
  card: {
    minHeight: COMPACT_JOB_CARD_HEIGHT,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: CARD_SURFACE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      default: {
        boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04), 0 4px 14px rgba(15, 23, 42, 0.06)',
      },
    }),
  },
  tappable: {
    gap: 10,
  },
  tappablePressed: {
    opacity: 0.94,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  clientCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  clientMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
    color: CARD_BLACK,
    letterSpacing: -0.2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  priceCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '42%',
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: CARD_BLACK,
    letterSpacing: -0.4,
  },
  rateLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 1,
    textTransform: 'capitalize',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: RADAR_BORDER,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  serviceIcon: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 1,
  },
  bodyTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CARD_BLACK,
    letterSpacing: -0.15,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusFootnote: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 118,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: CARD_BLACK,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  acceptBtnDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.85,
  },
  acceptBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  acceptBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
});
