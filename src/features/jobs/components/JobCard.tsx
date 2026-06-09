import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
import { Ionicons } from '@expo/vector-icons';
import { SwipeAcceptTrack } from '@components/worker/SwipeAcceptTrack';
import { SPACING } from '@constants/stitchStyles';
import { CHAMBA } from '@constants/chambaUI';
import { CategoryIconCircle } from '@utils/categoryVisual';
import { formatCurrency } from '@utils/formatters';
import { parseJobAddress } from '@utils/locationFormat';
import {
  formatScheduleDateLabel,
  formatScheduleTimeLabel,
  formatUrgencyLabel,
  normalizeUrgencyLevel,
} from '@utils/jobScheduling';
import type { Job } from '@/types';
import { jobHasRequestPhoto } from '@utils/jobRequestPhoto';

const DEEP_BLUE = '#1E293B';
const TITLE_COLOR = '#111827';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

interface JobCardProps {
  job:            Job;
  onPress:        () => void;
  showDistance?:  boolean;
  onAccept?:      () => void | Promise<void>;
  onInProcess?:   () => void;
  isAccepting?:   boolean;
  isAccepted?:    boolean;
  isInProcess?:   boolean;
  showSwipe?:     boolean;
  awaitingClientChoice?: boolean;
  acceptBlocked?: boolean;
  acceptBlockedMessage?: string;
  showDismissHint?: boolean;
}

const DetailRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}> = ({ icon, children }) => (
  <View style={styles.detailRow}>
    <Ionicons name={icon} size={15} color={MUTED} style={styles.detailIcon} />
    <View style={styles.detailContent}>{children}</View>
  </View>
);

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onPress,
  showDistance = true,
  onAccept,
  onInProcess,
  isAccepting = false,
  isAccepted = false,
  isInProcess = false,
  showSwipe = false,
  awaitingClientChoice = false,
  acceptBlocked = false,
  acceptBlockedMessage,
  showDismissHint = false,
}) => {
  const hasClientPhoto = jobHasRequestPhoto(job);
  const urgencyLevel = normalizeUrgencyLevel(job.urgency_level);
  const scheduleTimeLabel = formatScheduleTimeLabel(job.scheduled_time);
  const { department, detail } = parseJobAddress(job.location?.address);
  const locationLabel = department ?? detail ?? job.location?.address ?? 'Ubicación no indicada';
  const locationSub = department && detail ? detail : null;

  const whenLabel = formatUrgencyLabel(urgencyLevel);
  const whenDetail = (() => {
    if (urgencyLevel === 'hoy') {
      return scheduleTimeLabel ? scheduleTimeLabel : 'Lo antes posible';
    }
    if (urgencyLevel === 'manana') {
      const datePart = job.scheduled_date
        ? formatScheduleDateLabel(job.scheduled_date)
        : 'Día siguiente';
      return scheduleTimeLabel ? `${datePart} · ${scheduleTimeLabel}` : datePart;
    }
    if (job.scheduled_date) {
      const datePart = formatScheduleDateLabel(job.scheduled_date);
      return scheduleTimeLabel ? `${datePart} · ${scheduleTimeLabel}` : datePart;
    }
    return 'Fecha por confirmar';
  })();

  const price = formatCurrency(job.worker_payout || job.pay_amount);
  const showAcceptSwipe =
    showSwipe && onAccept && (job.status === 'open' || isInProcess);

  return (
    <View style={styles.card}>
      {showDismissHint ? (
        <View style={styles.dismissHintRow} pointerEvents="none">
          <Ionicons name="chevron-back" size={12} color="#9CA3AF" />
          <Text style={styles.dismissHintText}>Deslizá a la izquierda para apartar</Text>
        </View>
      ) : null}
      <ChambaPressable onPress={onPress} style={styles.cardBody}>
        <View style={styles.headerRow}>
          <CategoryIconCircle category={job.category} size={44} />
          <Text style={styles.title} numberOfLines={2}>
            {job.title}
          </Text>
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{price}</Text>
            <Text style={styles.priceCaption}>sugerido</Text>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          <DetailRow icon="location-outline">
            <Text style={styles.detailPrimary} numberOfLines={1}>
              {locationLabel}
            </Text>
            {locationSub ? (
              <Text style={styles.detailSecondary} numberOfLines={1}>
                {locationSub}
              </Text>
            ) : null}
            {showDistance && job.location?.distance_km != null ? (
              <Text style={styles.detailSecondary}>
                {job.location.distance_km.toFixed(1)} km de ti
              </Text>
            ) : null}
          </DetailRow>

          <DetailRow icon="calendar-outline">
            <View style={styles.whenRow}>
              <View style={[
                styles.whenBadge,
                urgencyLevel === 'hoy' && styles.whenBadgeToday,
              ]}>
                <Text style={[
                  styles.whenBadgeText,
                  urgencyLevel === 'hoy' && styles.whenBadgeTextToday,
                ]}>
                  {whenLabel}
                </Text>
              </View>
              <Text style={styles.detailPrimary} numberOfLines={1}>
                {whenDetail}
              </Text>
            </View>
          </DetailRow>

          {job.duration_hours > 0 ? (
            <DetailRow icon="time-outline">
              <Text style={styles.detailPrimary}>
                {job.duration_hours}h estimadas
              </Text>
            </DetailRow>
          ) : null}

          {hasClientPhoto ? (
            <DetailRow icon="camera-outline">
              <Text style={styles.detailPrimary}>Incluye foto del cliente</Text>
            </DetailRow>
          ) : null}
        </View>
      </ChambaPressable>

      {awaitingClientChoice ? (
        <View style={styles.awaitingBox}>
          <Ionicons name="hourglass-outline" size={16} color={MUTED} />
          <Text style={styles.awaitingText}>Postulaste — el cliente te elegirá</Text>
        </View>
      ) : showAcceptSwipe ? (
        <View style={styles.swipeWrap}>
          <SwipeAcceptTrack
            resetKey={job.id}
            onAccept={onAccept}
            onInProcess={onInProcess}
            isLoading={isAccepting}
            isAccepted={isAccepted}
            isInProcess={isInProcess}
            disabled={acceptBlocked}
            disabledLabel={acceptBlockedMessage}
          />
        </View>
      ) : (
        <ChambaPressable onPress={onPress} style={styles.tapHint} pressScale={0.98}>
          <Text style={styles.tapHintText}>Ver detalle</Text>
          <Ionicons name="chevron-forward" size={16} color={MUTED} />
        </ChambaPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: SPACING.sm + 4,
    overflow: 'hidden',
  },
  dismissHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    paddingBottom: 2,
    paddingHorizontal: 12,
  },
  dismissHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.1,
  },
  cardBody: {
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: TITLE_COLOR,
    letterSpacing: -0.2,
    paddingTop: 2,
  },
  priceBlock: {
    alignItems: 'flex-end',
    minWidth: 88,
  },
  price: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: DEEP_BLUE,
    letterSpacing: -0.3,
  },
  priceCaption: {
    fontSize: 10,
    fontWeight: '600',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  detailsGrid: {
    gap: 10,
    paddingTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailIcon: {
    marginTop: 2,
    width: 16,
  },
  detailContent: {
    flex: 1,
    gap: 2,
  },
  detailPrimary: {
    fontSize: 14,
    fontWeight: '500',
    color: MUTED,
    lineHeight: 20,
  },
  detailSecondary: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 16,
  },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  whenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  whenBadgeToday: {
    backgroundColor: '#E2E8F0',
  },
  whenBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: DEEP_BLUE,
    letterSpacing: 0.2,
  },
  whenBadgeTextToday: {
    color: DEEP_BLUE,
  },
  swipeWrap: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  tapHintText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
  },
  awaitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: '#F9FAFB',
  },
  awaitingText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
  },
});
