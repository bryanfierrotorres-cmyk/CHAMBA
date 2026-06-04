import React, { useMemo, useState, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ChambaSlidingToggle } from '@components/chamba/ChambaSlidingToggle';
import { useAuthStore } from '@store/authStore';
import { useClientOrders } from '@features/client/hooks/useClientOrders';
import { WorkerReviewsPanel } from '@features/reviews/components/WorkerReviewsPanel';
import { useWorkerReviews } from '@features/reviews/hooks/useWorkerReviews';
import { formatCurrency, formatDate, getCategoryLabel, getClientOrderStatusLabel } from '@utils/formatters';
import { getCategoryVisual } from '@utils/categoryVisual';
import { ClientJobApplicantPanel } from '@components/client/ClientJobApplicantPanel';
import type { ClientOrderJob, JobStatus, ClientOrdersStackParamList } from '@/types';

type OrdersNav = NativeStackNavigationProp<ClientOrdersStackParamList, 'ClientOrdersList'>;

type OrderFilter = 'activas' | 'historial';

const ORDER_FILTER_TABS = [
  { id: 'activas' as const, label: 'Activas' },
  { id: 'historial' as const, label: 'Historial' },
];

const ACTIVE_STATUSES = new Set<JobStatus>(['open', 'taken', 'in_progress']);
const CARD_STEP_SHADOW = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 4,
} as const;

interface StatusBadge {
  label: string;
  container: object;
  text: object;
}

const statusBadge = (job: ClientOrderJob): StatusBadge => {
  const label = getClientOrderStatusLabel(job.status, job.operational_phase).toUpperCase();

  switch (job.status) {
    case 'taken':
    case 'in_progress':
      return {
        label,
        container: styles.badgeEnCurso,
        text: styles.badgeTextEnCurso,
      };
    case 'open':
      return {
        label: label || 'EN PENDIENTE',
        container: styles.badgePendiente,
        text: styles.badgeTextPendiente,
      };
    case 'completed':
      return {
        label: 'COMPLETADO',
        container: styles.badgeCompletado,
        text: styles.badgeTextCompletado,
      };
    case 'cancelled':
      return {
        label: 'CANCELADO',
        container: styles.badgeCancelado,
        text: styles.badgeTextCancelado,
      };
    default:
      return {
        label: 'EN PROCESO',
        container: styles.badgeEnCurso,
        text: styles.badgeTextEnCurso,
      };
  }
};

const canRateWorker = (job: ClientOrderJob): boolean =>
  !!job.assigned_worker &&
  ['taken', 'in_progress', 'completed'].includes(job.status);

/** Reseña del cliente: solo si aún no calificó (una vez por técnico). */
const ClientOrderReview: React.FC<{
  job: ClientOrderJob;
  clientId: string;
  clientName: string;
}> = ({ job, clientId, clientName }) => {
  const worker = job.assigned_worker;
  const { reviews, isLoading } = useWorkerReviews(worker?.id);
  const alreadyReviewed = reviews.some((r) => r.reviewer_id === clientId);

  if (!worker || !canRateWorker(job) || isLoading || alreadyReviewed) {
    return null;
  }

  return (
    <View style={styles.reviewBox}>
      <WorkerReviewsPanel
        workerId={worker.id}
        workerName={worker.full_name}
        reviewerId={clientId}
        reviewerRole="client"
        reviewerName={clientName}
        allowReview
        compact
      />
    </View>
  );
};

interface OrderCardProps {
  job: ClientOrderJob;
  clientId: string;
  clientName: string;
  onOpenCompleted?: (jobId: string) => void;
  onApplicantDecision?: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({
  job, clientId, clientName, onOpenCompleted, onApplicantDecision,
}) => {
  const badge = statusBadge(job);
  const visual = getCategoryVisual(job.category);
  const title = job.title?.trim() || getCategoryLabel(job.category);
  const isVariablePrice = job.status === 'open' && !job.pay_amount;
  const isCompleted = job.status === 'completed';

  const handleCardPress = () => {
    if (isCompleted && onOpenCompleted) {
      onOpenCompleted(job.id);
    }
  };

  return (
    <View style={styles.orderWrap}>
      <TouchableOpacity
        style={styles.requestCard}
        activeOpacity={0.88}
        onPress={handleCardPress}
        disabled={!isCompleted}
      >
        <View style={styles.cardContent}>
          <View style={badge.container}>
            <Text style={badge.text}>{badge.label}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.cardSubtitle}>
            {isCompleted ? 'Toca para ver resumen · ' : ''}{formatDate(job.created_at)}
          </Text>
          <Text style={isVariablePrice ? styles.cardPriceVariable : styles.cardPrice}>
            {isVariablePrice ? 'Bajo cotización' : formatCurrency(job.pay_amount)}
          </Text>
        </View>
        <View style={styles.cardTrailing}>
          <View style={[styles.iconCircleRight, { backgroundColor: visual.color }]}>
            {visual.icon}
          </View>
          {isCompleted && (
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" style={{ marginTop: 8 }} />
          )}
        </View>
      </TouchableOpacity>

      {job.status === 'open' && (
        <ClientJobApplicantPanel
          jobId={job.id}
          clientId={clientId}
          jobStatus={job.status}
          onDecision={onApplicantDecision}
        />
      )}

      <ClientOrderReview job={job} clientId={clientId} clientName={clientName} />
    </View>
  );
};

export const ClientOrdersScreen: React.FC = () => {
  const navigation = useNavigation<OrdersNav>();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('activas');

  const {
    data: jobs = [],
    isLoading,
    refetch,
    isRefetching,
    error: ordersError,
  } = useClientOrders();

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) refetch();
    }, [profile?.id, refetch]),
  );

  const filteredJobs = useMemo((): ClientOrderJob[] => {
    if (activeFilter === 'activas') {
      return jobs.filter((j: ClientOrderJob) => ACTIVE_STATUSES.has(j.status));
    }
    return jobs.filter((j: ClientOrderJob) => j.status === 'completed' || j.status === 'cancelled');
  }, [jobs, activeFilter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Mis Solicitudes</Text>
          <Text style={styles.headerSubtitle}>Monitoreá tus servicios en tiempo real</Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={20} color="#0284C7" />
        </TouchableOpacity>
      </View>

      <ChambaSlidingToggle
        options={ORDER_FILTER_TABS}
        active={activeFilter}
        onChange={setActiveFilter}
        style={styles.orderFilterToggle}
      />

      {ordersError ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
          <Text style={styles.errorTitle}>No se pudieron cargar tus solicitudes</Text>
          <Text style={styles.errorSub}>
            {ordersError instanceof Error ? ordersError.message : 'Error de conexión'}
          </Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.errorRetry}>
            <Text style={styles.errorRetryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0284C7" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContainer, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0284C7" />
          }
        >
          {filteredJobs.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={[styles.iconCircleRight, { backgroundColor: '#007AFF' }]}>
                <Ionicons name="document-text-outline" size={22} color="#FFF" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeFilter === 'activas' ? 'Sin solicitudes activas' : 'Sin historial aún'}
              </Text>
              <Text style={styles.emptySub}>
                {activeFilter === 'activas'
                  ? 'Ve a Servicios y solicitá tu primera chamba.'
                  : 'Tus servicios completados aparecerán aquí.'}
              </Text>
            </View>
          ) : (
            filteredJobs.map((job) =>
              profile ? (
                <OrderCard
                  key={job.id}
                  job={job}
                  clientId={profile.id}
                  clientName={profile.full_name}
                  onOpenCompleted={(jobId) =>
                    navigation.navigate('ClientCompletedJob', { jobId })
                  }
                  onApplicantDecision={() => void refetch()}
                />
              ) : null,
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F2F4F7',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '600', color: '#0F172A', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: '#8A94A6', marginTop: 2, fontWeight: '400' },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_STEP_SHADOW,
  },

  orderFilterToggle: {
    marginHorizontal: 20,
    marginBottom: 16,
  },

  scrollContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  orderWrap: { marginBottom: 14 },
  requestCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...CARD_STEP_SHADOW,
  },
  cardContent: { flex: 1, paddingRight: 8, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
  cardSubtitle: { fontSize: 12, color: '#8A94A6', marginBottom: 8, fontWeight: '400' },
  cardPrice: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  cardPriceVariable: { fontSize: 13, fontWeight: '500', color: '#8A94A6' },

  cardTrailing: {
    alignItems: 'center',
    flexShrink: 0,
  },
  iconCircleRight: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeEnCurso: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeTextEnCurso: { fontSize: 9, fontWeight: '700', color: '#0369A1' },
  badgePendiente: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeTextPendiente: { fontSize: 9, fontWeight: '700', color: '#B45309' },
  badgeCompletado: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeTextCompletado: { fontSize: 9, fontWeight: '700', color: '#15803D' },
  badgeCancelado: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeTextCancelado: { fontSize: 9, fontWeight: '700', color: '#B91C1C' },

  reviewBox: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    marginTop: -4,
    ...CARD_STEP_SHADOW,
  },

  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    ...CARD_STEP_SHADOW,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#8A94A6', textAlign: 'center', fontWeight: '400', lineHeight: 20 },
  errorCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 24,
    marginHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    ...CARD_STEP_SHADOW,
  },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  errorSub: { fontSize: 13, color: '#8A94A6', textAlign: 'center', lineHeight: 20 },
  errorRetry: {
    marginTop: 8,
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorRetryText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
