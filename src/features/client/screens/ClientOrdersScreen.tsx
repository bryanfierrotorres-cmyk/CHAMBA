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
import { WorkerRatingPrompt } from '@components/reviews/WorkerRatingPrompt';
import { ClientJobApplicantPanel } from '@components/client/ClientJobApplicantPanel';
import {
  useClientOpenJobsApplicationsRealtime,
  useJobWorkerApplications,
} from '@features/client/hooks/useJobWorkerApplications';
import { CARD_STEP_SHADOW } from '@constants/chambaUI';
import {
  isClientOrderActive,
  isClientOrderHistory,
  isClientOrderPending,
} from '@utils/clientOrderClassification';
import type {
  AssignedWorkerSummary,
  ClientOrderJob,
  ClientOrdersStackParamList,
  JobWorkerApplication,
} from '@/types';

type OrdersNav = NativeStackNavigationProp<ClientOrdersStackParamList, 'ClientOrdersList'>;

type OrderFilter = 'pendientes' | 'activas' | 'historial';

const ORDER_FILTER_TABS = [
  { id: 'pendientes' as const, label: 'Pendientes' },
  { id: 'activas' as const, label: 'Activas' },
  { id: 'historial' as const, label: 'Historial' },
];

const EMPTY_COPY: Record<OrderFilter, { title: string; subtitle: string }> = {
  pendientes: {
    title: 'Sin solicitudes pendientes',
    subtitle: 'Publicá una chamba en Servicios y esperá postulaciones de técnicos.',
  },
  activas: {
    title: 'Sin chambas en curso',
    subtitle: 'Cuando elijas un técnico, el servicio aparecerá aquí.',
  },
  historial: {
    title: 'Sin historial aún',
    subtitle: 'Tus servicios completados o cancelados aparecerán aquí.',
  },
};

const filterClientOrders = (jobs: ClientOrderJob[], filter: OrderFilter): ClientOrderJob[] => {
  if (filter === 'pendientes') {
    return jobs.filter((j) => isClientOrderPending(j));
  }
  if (filter === 'activas') {
    return jobs.filter((j) => isClientOrderActive(j));
  }
  return jobs.filter((j) => isClientOrderHistory(j));
};

/** Calificación solo cuando el servicio está finalizado. */
const canRateWorker = (job: ClientOrderJob): boolean =>
  job.status === 'completed' && !!job.assigned_worker;

const resolveAssignedWorker = (
  raw: ClientOrderJob['assigned_worker'] | AssignedWorkerSummary[] | null | undefined,
): AssignedWorkerSummary | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
};

const ClientOrderReview = React.memo<{
  job: ClientOrderJob;
  clientId: string;
  clientName: string;
}>(function ClientOrderReview({ job, clientId, clientName }) {
  const worker = resolveAssignedWorker(job.assigned_worker);
  if (!worker?.id || !canRateWorker(job)) return null;

  return (
    <WorkerRatingPrompt
      workerId={worker.id}
      workerName={worker.full_name}
      reviewerId={clientId}
      reviewerRole="client"
      reviewerName={clientName}
    />
  );
});

interface OrderCardProps {
  job: ClientOrderJob;
  clientId: string;
  clientName: string;
  onOpenCompleted?: (jobId: string) => void;
  onApplicantDecision?: () => void;
  onOpenChat?: (jobId: string, readOnly: boolean) => void;
}

const orderCardPropsEqual = (prev: OrderCardProps, next: OrderCardProps): boolean =>
  prev.clientId === next.clientId
  && prev.clientName === next.clientName
  && prev.job.id === next.job.id
  && prev.job.status === next.job.status
  && prev.job.updated_at === next.job.updated_at
  && prev.job.operational_phase === next.job.operational_phase
  && prev.job.assigned_worker_id === next.job.assigned_worker_id
  && prev.onOpenCompleted === next.onOpenCompleted
  && prev.onApplicantDecision === next.onApplicantDecision
  && prev.onOpenChat === next.onOpenChat;

const OrderCard = React.memo<OrderCardProps>(function OrderCard({
  job, clientId, clientName, onOpenCompleted, onApplicantDecision, onOpenChat,
}) {
  const ownerClientId = job.created_by || clientId;
  const isOpen = job.status === 'open';
  const {
    data: apps = [],
    isLoading: appsLoading,
    error: appsError,
    refetch: refetchApps,
  } = useJobWorkerApplications(job.id, ownerClientId, isOpen);
  const pendingCount = apps.filter(
    (a: JobWorkerApplication) => a.selection_status === 'pending',
  ).length;
  const appsErrorMessage = appsError instanceof Error ? appsError.message : null;

  return (
    <View style={styles.orderWrap}>
      <ClientActiveServiceCard
        job={job}
        pendingApplicationsCount={pendingCount}
        onOpenChat={onOpenChat}
        onPressCompleted={onOpenCompleted}
      />

      {isOpen && (
        <ClientJobApplicantPanel
          jobId={job.id}
          clientId={ownerClientId}
          jobStatus={job.status}
          applications={apps}
          loading={appsLoading}
          error={appsErrorMessage}
          onRefetch={() => void refetchApps()}
          onDecision={onApplicantDecision}
        />
      )}

      <ClientOrderReview job={job} clientId={clientId} clientName={clientName} />
    </View>
  );
}, orderCardPropsEqual);

export const ClientOrdersScreen: React.FC = () => {
  const navigation = useNavigation<OrdersNav>();
  const insets = useSafeAreaInsets();
  const profileId = useAuthStore((s) => s.profile?.id);
  const profileName = useAuthStore((s) => s.profile?.full_name ?? 'Cliente');
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('pendientes');

  const {
    data: jobs = [],
    isLoading,
    refetch,
    isRefetching,
    isStale,
    error: ordersError,
  } = useClientOrders();

  useClientOpenJobsApplicationsRealtime(jobs, profileId);

  useFocusEffect(
    useCallback(() => {
      if (profileId && isStale) void refetch();
    }, [profileId, isStale, refetch]),
  );

  const handleOpenCompleted = useCallback(
    (jobId: string) => navigation.navigate('ClientCompletedJob', { jobId }),
    [navigation],
  );

  const handleApplicantDecision = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleOpenChat = useCallback(
    (jobId: string, readOnly: boolean) => navigation.navigate('JobChat', { jobId, readOnly }),
    [navigation],
  );

  const filteredJobs = useMemo(
    (): ClientOrderJob[] => filterClientOrders(jobs, activeFilter),
    [jobs, activeFilter],
  );

  const emptyCopy = EMPTY_COPY[activeFilter];

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
        cornerRadius={14}
        activeFontWeight="600"
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
      ) : isLoading && jobs.length === 0 ? (
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
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptySub}>{emptyCopy.subtitle}</Text>
            </View>
          ) : (
            filteredJobs.map((job) =>
              profileId && job?.id ? (
                <OrderCard
                  key={job.id}
                  job={job}
                  clientId={profileId}
                  clientName={profileName}
                  onOpenCompleted={handleOpenCompleted}
                  onApplicantDecision={handleApplicantDecision}
                  onOpenChat={handleOpenChat}
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
