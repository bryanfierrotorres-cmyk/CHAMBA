import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ClientActiveServiceCard } from '@components/client/ClientActiveServiceCard';
import { useAuthStore } from '@store/authStore';
import { useClientOrders, patchClientOrderAfterWorkerApproval, patchClientOrderRowInCache, clientOrdersQueryKey } from '@features/client/hooks/useClientOrders';
import { cancelClientJob } from '@features/jobs/services/jobsService';
import { WorkerRatingPrompt } from '@components/reviews/WorkerRatingPrompt';
import { ClientJobApplicantPanel } from '@components/client/ClientJobApplicantPanel';
import {
  useClientOpenJobsApplicationsRealtime,
  useJobWorkerApplications,
} from '@features/client/hooks/useJobWorkerApplications';
import { CARD_STEP_SHADOW } from '@constants/chambaUI';
import {
  ensureChatSessionForProfile,
  showChatSessionRequiredAlert,
} from '@features/chat/utils/ensureChatSession';
import { useSupportBubbleScrollHandlers } from '@hooks/useSupportBubbleScrollHandlers';
import {
  isClientOrderActive,
  isClientOrderHistory,
  isClientOrderPending,
} from '@utils/clientOrderClassification';
import { isJobExpiredLocally } from '@constants/jobExpiry';
import { SkeletonCard } from '@components/SkeletonCard';
import { SmoothEntrance } from '@components/SmoothEntrance';
import { SlidingPillTabs } from '@components/SlidingPillTabs';
import { AnimatedRefreshIcon } from '@components/AnimatedRefreshIcon';
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
  onApplicantDecision?: (result: { jobId: string; workerId: string }) => void;
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
  const isBiddingPhase = ['open', 'pending_bidding', 'counter_offered'].includes(job.status);
  const {
    data: apps = [],
    isLoading: appsLoading,
    error: appsError,
    refetch: refetchApps,
  } = useJobWorkerApplications(job.id, ownerClientId, isBiddingPhase);
  const pendingCount = apps.filter(
    (a: JobWorkerApplication) => a.selection_status === 'pending',
  ).length;
  const appsErrorMessage = appsError instanceof Error ? appsError.message : null;
  const [localExpired, setLocalExpired] = useState(() =>
    isJobExpiredLocally(job.created_at),
  );

  useEffect(() => {
    setLocalExpired(isJobExpiredLocally(job.created_at));
  }, [job.created_at, job.id]);

  const queryClient = useQueryClient();
  const [canceling, setCanceling] = useState(false);

  const handleCancel = useCallback(() => {
    const doCancel = async () => {
      setCanceling(true);
      try {
        const updated = await cancelClientJob(job.id);
        patchClientOrderRowInCache(queryClient, ownerClientId, {
          id: updated.id,
          status: updated.status,
          updated_at: updated.updated_at,
        });
        void queryClient.invalidateQueries({ queryKey: clientOrdersQueryKey(ownerClientId) });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error al cancelar la solicitud';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Demasiado tarde', msg);
        }
      } finally {
        setCanceling(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que deseas cancelar esta solicitud?')) {
        void doCancel();
      }
      return;
    }

    Alert.alert(
      'Cancelar Solicitud',
      '¿Estás seguro de que deseas cancelar esta solicitud?',
      [
        { text: 'No, mantener', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: doCancel,
        },
      ]
    );
  }, [job.id, ownerClientId, queryClient]);

  const showApplicantPanel = isBiddingPhase && (!localExpired || pendingCount > 0);

  return (
    <View style={styles.orderWrap}>
      <ClientActiveServiceCard
        job={job}
        clientId={ownerClientId}
        pendingApplicationsCount={pendingCount}
        onExpiredChange={setLocalExpired}
        onOpenChat={onOpenChat}
        onPressCompleted={onOpenCompleted}
        onCancel={handleCancel}
        canceling={canceling}
      />

      {showApplicantPanel && (
        <ClientJobApplicantPanel
          jobId={job.id}
          clientId={ownerClientId}
          jobStatus={job.status}
          applications={apps}
          jobLat={job.location?.lat}
          jobLng={job.location?.lng}
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
  const queryClient = useQueryClient();
  const supportBubbleScroll = useSupportBubbleScrollHandlers();
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

  const handleApplicantDecision = useCallback(
    (result?: {
      jobId: string;
      workerId: string;
      workerSummary?: { id: string; full_name: string; avatar_url: string | null; phone: string | null } | null;
    }) => {
      if (result && profileId) {
        patchClientOrderAfterWorkerApproval(
          queryClient,
          profileId,
          result.jobId,
          result.workerId,
          result.workerSummary ?? null,
        );
      }
      void refetch();
    },
    [refetch, profileId, queryClient],
  );

  const handleOpenChat = useCallback(
    async (jobId: string, readOnly: boolean) => {
      const currentProfile = useAuthStore.getState().profile;
      if (!currentProfile) return;
      const ready = await ensureChatSessionForProfile(currentProfile);
      if (!ready) {
        showChatSessionRequiredAlert();
        return;
      }
      navigation.navigate('JobChat', { jobId, readOnly });
    },
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
        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
          <Ionicons name="menu-outline" size={28} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Solicitudes</Text>
        <AnimatedRefreshIcon 
          isRefetching={isRefetching} 
          onPress={() => refetch()} 
          style={styles.headerIconBtn} 
          color="#0F172A"
          size={24}
        />
      </View>

      <SlidingPillTabs
        options={ORDER_FILTER_TABS as any}
        active={activeFilter}
        onChange={(id) => setActiveFilter(id as OrderFilter)}
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
        <View style={styles.skeletonContainer}>
          <SkeletonCard variant="request" />
          <SkeletonCard variant="request" />
          <SkeletonCard variant="request" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContainer, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0284C7" />
          }
          {...supportBubbleScroll}
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
                <SmoothEntrance key={job.id}>
                  <OrderCard
                    job={job}
                    clientId={profileId}
                    clientName={profileName}
                    onOpenCompleted={handleOpenCompleted}
                    onApplicantDecision={handleApplicantDecision}
                    onOpenChat={handleOpenChat}
                  />
                </SmoothEntrance>
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
  headerIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#0F172A', 
    letterSpacing: -0.5,
    fontFamily: 'sans-serif', // Use default sans-serif bold
  },

  scrollContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  skeletonContainer: { paddingHorizontal: 20, paddingTop: 10, gap: 16 },

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
