import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackButton } from '@components/navigation/ScreenBackButton';
import { Avatar } from '@components/Avatar';
import { StarRating } from '@components/StarRating';
import { useAuthStore } from '@store/authStore';
import { fetchClientJobSummary } from '@features/jobs/services/jobsService';
import {
  formatCurrency,
  formatDate,
  formatTime,
  getCategoryLabel,
  coerceNumber,
} from '@utils/formatters';
import { getCategoryVisual } from '@utils/categoryVisual';
import type { ClientOrdersStackParamList } from '@/types';

type Route = RouteProp<ClientOrdersStackParamList, 'ClientCompletedJob'>;
type Nav = NativeStackNavigationProp<ClientOrdersStackParamList, 'ClientCompletedJob'>;

const CARD_SHADOW = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 4,
} as const;

export const ClientCompletedJobScreen: React.FC = () => {
  const { jobId } = useRoute<Route>().params;
  const navigation = useNavigation<Nav>();
  const profile = useAuthStore((s) => s.profile);

  const { data, isLoading, error } = useQuery({
    queryKey: ['client-job-summary', jobId, profile?.id],
    queryFn: () => fetchClientJobSummary(jobId, profile!.id),
    enabled: !!profile?.id,
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <ScreenBackButton onPress={() => navigation.goBack()} />
          <Text style={styles.topTitle}>Resumen del servicio</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          {error ? (
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'No se pudo cargar'}
            </Text>
          ) : (
            <ActivityIndicator size="large" color="#0284C7" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const { job, completed_at, client_review, worker_rating_avg } = data;
  const worker = job.assigned_worker;
  const visual = getCategoryVisual(job.category);
  const title = job.title?.trim() || getCategoryLabel(job.category);
  const finishedLabel = completed_at
    ? `${formatDate(completed_at)} · ${formatTime(completed_at)}`
    : formatDate(job.updated_at);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <ScreenBackButton onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle} numberOfLines={1}>Resumen del servicio</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={[styles.iconCircle, { backgroundColor: visual.color }]}>
            {visual.icon}
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroMeta}>{getCategoryLabel(job.category)}</Text>
            <Text style={styles.heroPrice}>{formatCurrency(job.pay_amount)}</Text>
          </View>
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#15803D" />
            <Text style={styles.completedBadgeText}>Completado</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoRow icon="calendar-outline" label="Finalizado" value={finishedLabel} />
          <InfoRow icon="time-outline" label="Duración" value={`${job.duration_hours} h`} />
          <InfoRow
            icon="location-outline"
            label="Ubicación"
            value={job.location?.address ?? '—'}
          />
        </View>

        {worker && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>TU TÉCNICO</Text>
            <View style={styles.workerRow}>
              <Avatar uri={worker.avatar_url} name={worker.full_name} size={52} />
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{worker.full_name}</Text>
                <StarRating
                  rating={worker_rating_avg}
                  size="sm"
                  showCount={false}
                />
                <Text style={styles.workerRatingHint}>
                  {worker_rating_avg != null
                    ? `Promedio ${coerceNumber(worker_rating_avg).toFixed(1)} estrellas`
                    : 'Sin calificaciones aún'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {client_review && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>TU RESEÑA</Text>
            <View style={styles.reviewRow}>
              <StarRating
                rating={coerceNumber(client_review.rating, 0)}
                showCount={false}
                size="md"
              />
              <Text style={styles.reviewDate}>
                {formatDate(client_review.created_at)} · {formatTime(client_review.created_at)}
              </Text>
            </View>
            <Text style={styles.reviewComment}>{client_review.comment}</Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>ANTES Y DESPUÉS</Text>
          <View style={styles.photosRow}>
            <PhotoPanel label="Antes" uri={job.before_photo_url} />
            <PhotoPanel label="Después" uri={job.after_photo_url} />
          </View>
          {!job.before_photo_url && !job.after_photo_url && (
            <Text style={styles.photosEmpty}>
              El técnico aún no subió fotos de este trabajo.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const InfoRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={18} color="#64748B" />
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const PhotoPanel: React.FC<{ label: string; uri?: string | null }> = ({ label, uri }) => (
  <View style={styles.photoPanel}>
    {uri ? (
      <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
    ) : (
      <View style={styles.photoPlaceholder}>
        <Ionicons name="image-outline" size={32} color="#94A3B8" />
      </View>
    )}
    <Text style={styles.photoLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F4F7' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#B91C1C', fontSize: 14, padding: 20, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },

  heroCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    ...CARD_SHADOW,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  heroMeta: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  heroPrice: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803D' },

  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    gap: 14,
    ...CARD_SHADOW,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#0F172A', lineHeight: 20 },

  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    gap: 12,
    ...CARD_SHADOW,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#64748B',
  },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  workerInfo: { flex: 1, gap: 4 },
  workerName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  workerRatingHint: { fontSize: 12, color: '#64748B' },

  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewDate: { fontSize: 12, color: '#64748B' },
  reviewComment: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },

  photosRow: { flexDirection: 'row', gap: 12 },
  photoPanel: { flex: 1, gap: 8 },
  photoImage: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  photoPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  photosEmpty: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
