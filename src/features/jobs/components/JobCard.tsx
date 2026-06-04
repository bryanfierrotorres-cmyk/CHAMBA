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
}) => {
  const isUrgent = job.required_workers > 1 && job.slots_taken >= job.required_workers - 1;
  const hasClientPhoto = jobHasRequestPhoto(job);
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
