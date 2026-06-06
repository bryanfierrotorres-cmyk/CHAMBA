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
import { ClientActiveServiceCard } from '@components/client/ClientActiveServiceCard';
import { useAuthStore } from '@store/authStore';
import { useClientOrders } from '@features/client/hooks/useClientOrders';
import { WorkerReviewsPanel } from '@features/reviews/components/WorkerReviewsPanel';
import { useWorkerReviews } from '@features/reviews/hooks/useWorkerReviews';
import { ClientJobApplicantPanel } from '@components/client/ClientJobApplicantPanel';
import { CARD_STEP_SHADOW } from '@constants/chambaUI';
import type { ClientOrderJob, JobStatus, ClientOrdersStackParamList } from '@/types';

type OrdersNav = NativeStackNavigationProp<ClientOrdersStackParamList, 'ClientOrdersList'>;

type OrderFilter = 'activas' | 'historial';

const ORDER_FILTER_TABS = [
  { id: 'activas' as const, label: 'Activas' },
  { id: 'historial' as const, label: 'Historial' },
];

const ACTIVE_STATUSES = new Set<JobStatus>(['open', 'taken', 'in_progress']);

/** Calificación solo cuando el servicio está finalizado. */
const canRateWorker = (job: ClientOrderJob): boolean =>
  job.status === 'completed' && !!job.assigned_worker;

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
      <Text style={styles.reviewHeading}>¿Cómo fue tu experiencia?</Text>
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
  onOpenChat?: (jobId: string, readOnly: boolean) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({
  job, clientId, clientName, onOpenCompleted, onApplicantDecision, onOpenChat,
}) => (
  <View style={styles.orderWrap}>
    <ClientActiveServiceCard
      job={job}
      onOpenChat={onOpenChat}
      onPressCompleted={onOpenCompleted}
    />

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
                  onOpenChat={(jobId, readOnly) =>
                    navigation.navigate('JobChat', { jobId, readOnly })
                  }
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

  orderWrap: { marginBottom: 16, gap: 10 },

  reviewBox: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    ...CARD_STEP_SHADOW,
  },
  reviewHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
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
  iconCircleRight: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
