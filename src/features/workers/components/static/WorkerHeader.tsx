import React from 'react';
import { memo } from 'react';
const _keepReact = React;
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { AvailabilityBadge, AVAILABILITY_CONFIG } from '@components/AvailabilitySelector';
import { formatRatingAvg } from '@utils/formatters';
import { M3, SPACING, BORDER_RADIUS, FONT_SIZE } from '@constants/stitchStyles';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';
import type { AvailabilityStatus, UserProfile, WorkerProfile } from '@/types';

interface WorkerHeaderProps {
  profile: UserProfile;
  workerProfile: WorkerProfile | null;
  uploadingAvatar: boolean;
  avatarPreview: string | null;
  onPickAvatar: () => void;
  onScrollToReviews: () => void;
}

const WorkerHeaderComponent: React.FC<WorkerHeaderProps> = ({
  profile,
  workerProfile,
  uploadingAvatar,
  avatarPreview,
  onPickAvatar,
  onScrollToReviews,
}) => {
  const currentAvailability: AvailabilityStatus =
    workerProfile?.availability_status === 'available'
    || workerProfile?.availability_status === 'busy'
    || workerProfile?.availability_status === 'offline'
      ? workerProfile.availability_status
      : 'offline';
      
  const availCfg = AVAILABILITY_CONFIG[currentAvailability];
  const ratingDisplay = workerProfile?.rating_avg && workerProfile.rating_avg > 0 
    ? formatRatingAvg(workerProfile.rating_avg) 
    : '✨ Primera Chamba';
  const reviewCount = workerProfile?.total_reviews ?? 0;

  return (
    <View style={styles.profileCard}>
      <View style={styles.profileGradient} />

      <TouchableOpacity
        onPress={onPickAvatar}
        disabled={uploadingAvatar}
        style={styles.avatarWrap}
      >
        <Avatar
          uri={avatarPreview ?? profile.avatar_url}
          name={profile.full_name}
          size={96}
          style={styles.avatarImg}
        />
        <View style={styles.cameraBtn}>
          {uploadingAvatar
            ? <ActivityIndicator size="small" color={M3.onPrimary} />
            : <Ionicons name="camera" size={14} color={M3.onPrimary} />
          }
        </View>
        <View style={[styles.availRing, { borderColor: availCfg.color }]} />
      </TouchableOpacity>

      <Text style={styles.profileName}>{profile.full_name}</Text>

      {profile.is_approved ? (
        <View style={styles.verifiedPill}>
          <Ionicons name="shield-checkmark" size={16} color={M3.onSecondaryContainer} />
          <Text style={styles.verifiedPillText}>Perfil Verificado</Text>
        </View>
      ) : (
        <View style={styles.pendingPill}>
          <Ionicons name="time-outline" size={16} color={M3.onTertiaryFixedVariant} />
          <Text style={styles.pendingPillText}>Pendiente de aprobación</Text>
        </View>
      )}

      <View style={{ marginTop: SPACING.sm }}>
        <AvailabilityBadge status={currentAvailability} />
      </View>

      <View style={styles.ratingBento}>
        <View style={styles.bentoTile}>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingValue}>
              {ratingDisplay === '✨ Primera Chamba' ? '—' : ratingDisplay}
            </Text>
          </View>
          <Text style={styles.bentoLabel}>Calificación</Text>
        </View>
        <TouchableOpacity
          style={styles.bentoTile}
          onPress={onScrollToReviews}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubbles-outline" size={28} color={M3.primary} style={{ marginBottom: 4 }} />
          <Text style={[styles.bentoValue, { color: M3.onBackground }]}>
            {reviewCount}
          </Text>
          <Text style={styles.bentoLabel}>Comentarios</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: SPACING.md + 4,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...CARD_STEP_SHADOW,
  },
  profileGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    backgroundColor: M3.primaryFixed,
    opacity: 0.5,
  },
  avatarWrap: {
    position: 'relative',
    marginTop: SPACING.sm,
    zIndex: 1,
  },
  avatarImg: {
    borderWidth: 4,
    borderColor: M3.surfaceContainerLowest,
  },
  availRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 58,
    borderWidth: 2.5,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: M3.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: M3.surfaceContainerLowest,
    zIndex: 2,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: M3.onBackground,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    textAlign: 'center',
    zIndex: 1,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: M3.secondaryContainer,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    zIndex: 1,
  },
  verifiedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: M3.onSecondaryContainer,
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: M3.tertiaryFixed,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    zIndex: 1,
  },
  pendingPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: M3.onTertiaryFixedVariant,
  },
  ratingBento: {
    flexDirection: 'row',
    gap: SPACING.sm + 4,
    marginTop: SPACING.md,
    width: '100%',
    zIndex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingValue: {
    fontSize: 32,
    fontWeight: '700',
    color: M3.onBackground,
    letterSpacing: -0.5,
  },
  bentoTile: {
    flex: 1,
    backgroundColor: M3.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: M3.surfaceVariant,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  bentoLabel: {
    fontSize: 14,
    color: M3.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'center',
  },
});

export const WorkerHeader = memo(WorkerHeaderComponent);
