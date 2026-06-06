import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
import { Ionicons } from '@expo/vector-icons';
import { SwipeAcceptTrack } from '@components/worker/SwipeAcceptTrack';
import {
  M3, SPACING, BORDER_RADIUS,
  CARD_ELEVATION, stitchTypography, stitchLayout,
} from '@constants/stitchStyles';
import { CHAMBA } from '@constants/chambaUI';
import { JobLocationLabel } from '@components/worker/JobLocationLabel';
import { CategoryIconCircle } from '@utils/categoryVisual';
import { formatCurrency } from '@utils/formatters';
import {
  formatScheduleDateLabel,
  formatScheduleTimeLabel,
  formatUrgencyLabel,
  normalizeUrgencyLevel,
} from '@utils/jobScheduling';
import { openJobLocationInMaps } from '@utils/openMaps';
import { hasUsableJobCoordinates } from '@utils/shareJobLocation';
import type { Job } from '@/types';
import { jobHasRequestPhoto } from '@utils/jobRequestPhoto';

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
  /** Postuló y espera que el cliente elija (máx. 3 técnicos). */
  awaitingClientChoice?: boolean;
  /** Cupo de 2 chambas activas lleno — ver radar pero no postular. */
  acceptBlocked?: boolean;
  acceptBlockedMessage?: string;
}

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
}) => {
  const isUrgent = job.required_workers > 1 && job.slots_taken >= job.required_workers - 1;
  const hasClientPhoto = jobHasRequestPhoto(job);
  const urgencyLevel = normalizeUrgencyLevel(job.urgency_level);
  const scheduleTimeLabel = formatScheduleTimeLabel(job.scheduled_time);
  const scheduleDetailText = (() => {
    if (urgencyLevel === 'hoy') {
      return scheduleTimeLabel ? `Hora: ${scheduleTimeLabel}` : 'Cuando antes';
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
  const canNavigate =
    showSwipe &&
    (!!job.location?.address?.trim() ||
      hasUsableJobCoordinates(job.location?.lat, job.location?.lng));

  const handleNavigate = () => {
    void openJobLocationInMaps({
      lat: job.location?.lat,
      lng: job.location?.lng,
      address: job.location?.address,
    });
  };

  return (
    <View style={styles.card}>
      <ChambaPressable onPress={onPress}>
        {/* Header */}
        <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <CategoryIconCircle category={job.category} size={48} />
          <View style={styles.titleBlock}>
            <Text style={stitchTypography.headlineMdMobile} numberOfLines={2}>
              {job.title}
            </Text>
            <JobLocationLabel
              address={job.location?.address}
              compact
              showDistance={showDistance}
              distanceKm={job.location?.distance_km}
            />
            {hasClientPhoto && (
              <View style={styles.photoBadge}>
                <Ionicons name="camera" size={12} color={M3.primary} />
                <Text style={styles.photoBadgeText}>Con foto del cliente</Text>
              </View>
            )}
            <View style={styles.scheduleRow}>
              <View style={[
                styles.scheduleBadge,
                urgencyLevel === 'hoy' && styles.scheduleBadgeUrgent,
              ]}>
                <Ionicons
                  name={
                    urgencyLevel === 'hoy'
                      ? 'flash'
                      : urgencyLevel === 'manana'
                        ? 'sunny-outline'
                        : 'calendar-outline'
                  }
                  size={12}
                  color={urgencyLevel === 'hoy' ? '#B45309' : M3.primary}
                />
                <Text style={[
                  styles.scheduleBadgeText,
                  urgencyLevel === 'hoy' && styles.scheduleBadgeTextUrgent,
                ]}>
                  {formatUrgencyLabel(urgencyLevel)}
                </Text>
              </View>
              <Text style={styles.scheduleDetail} numberOfLines={1}>
                {scheduleDetailText}
              </Text>
            </View>
          </View>
        </View>
        {isUrgent && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentText}>Urgente</Text>
          </View>
        )}
      </View>

      {/* Price */}
      <View style={styles.priceBlock}>
        <Text style={[stitchTypography.labelBold, styles.priceLabel]}>PRECIO SUGERIDO</Text>
        <Text style={stitchTypography.displayPrice}>
          {formatCurrency(job.worker_payout || job.pay_amount)}
        </Text>
        {job.duration_hours > 0 && (
          <Text style={stitchTypography.bodySm}>{job.duration_hours}h estimadas</Text>
        )}
      </View>

      <View style={stitchLayout.divider} />
      </ChambaPressable>

      {canNavigate && (
        <TouchableOpacity
          style={styles.navigateBtn}
          onPress={handleNavigate}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Abrir ubicación del cliente en mapa"
        >
          <Ionicons name="navigate" size={18} color={M3.primary} />
          <Text style={styles.navigateBtnText}>Ir al cliente (mapa)</Text>
        </TouchableOpacity>
      )}

      {/* Swipe or tap hint */}
      {awaitingClientChoice ? (
        <View style={styles.awaitingBox}>
          <Ionicons name="hourglass-outline" size={18} color={M3.primary} />
          <Text style={styles.awaitingText}>Postulaste — el cliente te elegirá</Text>
        </View>
      ) : showSwipe && onAccept && (job.status === 'open' || isInProcess) ? (
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
      ) : (
        <ChambaPressable onPress={onPress} style={styles.tapHint} pressScale={0.98}>
          <Text style={styles.tapHintText}>Toca para ver detalles</Text>
          <Ionicons name="chevron-forward" size={18} color={M3.outline} />
        </ChambaPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius:    16,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm + 4,
    gap:             SPACING.sm,
    ...CARD_ELEVATION,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.md,
    flex:          1,
  },
  titleBlock: {
    flex: 1,
    gap:  4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     2,
  },
  urgentBadge: {
    backgroundColor: M3.surfaceContainerHigh,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   4,
    borderRadius:      BORDER_RADIUS.sm,
  },
  urgentText: {
    fontSize:   12,
    fontWeight: '700',
    color:      M3.onSurfaceVariant,
  },
  priceBlock: {
    marginTop: SPACING.xs,
    gap:       2,
  },
  priceLabel: {
    color:         M3.outline,
    letterSpacing: 0.8,
  },
  tapHint: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
    paddingVertical: SPACING.xs,
  },
  tapHintText: {
    fontSize: 14,
    color:    M3.outline,
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     4,
    alignSelf:     'flex-start',
    backgroundColor: M3.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      BORDER_RADIUS.sm,
  },
  photoBadgeText: {
    fontSize:   11,
    fontWeight: '600',
    color:      M3.onPrimaryContainer,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           6,
    marginTop:     6,
  },
  scheduleBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      BORDER_RADIUS.sm,
    backgroundColor:   M3.primaryContainer,
  },
  scheduleBadgeUrgent: {
    backgroundColor: '#FEF3C7',
  },
  scheduleBadgeText: {
    fontSize:   11,
    fontWeight: '700',
    color:      M3.onPrimaryContainer,
  },
  scheduleBadgeTextUrgent: {
    color: '#B45309',
  },
  scheduleDetail: {
    flex:      1,
    fontSize:  12,
    color:     M3.onSurfaceVariant,
    fontWeight: '500',
  },
  navigateBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    paddingVertical:   10,
    paddingHorizontal: 12,
    borderRadius:      12,
    backgroundColor:   M3.primaryContainer,
    borderWidth:       1,
    borderColor:       M3.primary + '33',
  },
  navigateBtnText: {
    fontSize:   13,
    fontWeight: '700',
    color:      M3.primary,
  },
  awaitingBox: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    paddingVertical:   12,
    paddingHorizontal: 12,
    borderRadius:      12,
    backgroundColor:   M3.secondaryContainer,
  },
  awaitingText: {
    fontSize:   13,
    fontWeight: '700',
    color:      M3.onSecondaryContainer,
  },
});
