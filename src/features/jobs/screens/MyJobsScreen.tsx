import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
import { ChambaSlidingToggle } from '@components/chamba/ChambaSlidingToggle';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBadge } from '@components/Badge';
import { EmptyState } from '@components/EmptyState';
import { WorkerTopBar } from '@components/worker/WorkerTopBar';
import { JobOperationalStepper } from '@components/worker/JobOperationalStepper';
import {
  useMyJobs,
  useCompleteJob,
  useAdvanceOperationalPhase,
} from '../hooks/useJobs';
import { useAssignmentsStore } from '@store/assignmentsStore';
import { useAuthStore } from '@store/authStore';
import { M3, SPACING, CARD_ELEVATION } from '@constants/stitchStyles';
import { CHAMBA, chambaStyles } from '@constants/chambaUI';
import { CategoryIconCircle } from '@utils/categoryVisual';
import {
  formatCurrency,
  formatDate,
  getCategoryLabel,
} from '@utils/formatters';
import { confirmAction, showMessage } from '@utils/confirmAction';
import { JobChatEntryButton } from '@components/chat/JobChatEntryButton';
import { showJobChatEntry } from '@features/chat/utils/chatHelpers';
import {
  ensureChatSessionForProfile,
  showChatSessionRequiredAlert,
} from '@features/chat/utils/ensureChatSession';
import {
  isWorkerPendingClientSelection,
} from '@utils/jobActiveLimits';
import { useSyncWorkerLocationOnFocus } from '@hooks/useSyncWorkerLocationOnFocus';
import {
  isWorkerAgendaActive,
  isWorkerAgendaHistory,
  isActiveOperationalJob,
  getPhaseAction,
  resolveOperationalPhase,
} from '@utils/workerOperationalPhase';
import type { WorkerTabParamList, JobAssignment, WorkerOperationalPhase } from '@/types';

type Nav = BottomTabNavigationProp<WorkerTabParamList, 'MyJobs'>;
type AgendaFilter = 'activas' | 'historial';

const sortByRecentAssignment = (a: JobAssignment, b: JobAssignment): number =>
  new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();

export const MyJobsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  useSyncWorkerLocationOnFocus();
  const refreshStore = useAssignmentsStore((s) => s.refresh);
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useMyJobs();
  const assignments: JobAssignment[] = data ?? [];
  const { mutateAsync: completeMut, isPending: isCompleting } = useCompleteJob();
  const { mutateAsync: advanceMut, isPending: isAdvancing } = useAdvanceOperationalPhase();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>('activas');

  const { activeAssignments, historyAssignments } = useMemo(() => {
    const active: JobAssignment[] = [];
    const history: JobAssignment[] = [];
    for (const item of assignments) {
      if (isWorkerAgendaHistory(item)) {
        history.push(item);
      } else if (isWorkerAgendaActive(item)) {
        active.push(item);
      }
    }
    active.sort(sortByRecentAssignment);
    history.sort(sortByRecentAssignment);
    return { activeAssignments: active, historyAssignments: history };
  }, [assignments]);

  const filterTabs = useMemo(
    () => [
      {
        id: 'activas' as const,
        label:
          activeAssignments.length > 0
            ? `Activas (${activeAssignments.length})`
            : 'Activas',
      },
      {
        id: 'historial' as const,
        label:
          historyAssignments.length > 0
            ? `Historial (${historyAssignments.length})`
            : 'Historial',
      },
    ],
    [activeAssignments.length, historyAssignments.length],
  );

  const visibleAssignments =
    agendaFilter === 'activas' ? activeAssignments : historyAssignments;

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        void refreshStore(profile.id);
        void refetch();
      }
    }, [refreshStore, profile?.id, refetch]),
  );

  const handleAdvance = useCallback(async (
    item: JobAssignment,
    nextPhase: WorkerOperationalPhase,
  ) => {
    setBusyId(item.id);
    try {
      await advanceMut({
        jobId: item.job_id,
        nextPhase,
        job: item.job ?? null,
        workerId: item.worker_id,
      });
      if (nextPhase === 'en_route') {
        showMessage('En camino', 'El cliente fue notificado de que vas al destino.');
      } else if (nextPhase === 'arrived') {
        showMessage('Llegaste', 'El cliente fue notificado de que estás en el lugar.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar el estado';
      showMessage('Error', msg);
    } finally {
      setBusyId(null);
    }
  }, [advanceMut]);

  const handleFinalize = useCallback(async (item: JobAssignment) => {
    const actionConfig = getPhaseAction(resolveOperationalPhase(item.job));
    const confirmed = await confirmAction({
      title: actionConfig?.confirmTitle ?? '¿Finalizar servicio?',
      message: actionConfig?.confirmMessage ?? 'El cliente verá el estado Finalizado.',
      confirmLabel: actionConfig?.confirmLabel ?? 'Finalizar',
      destructive: true,
    });
    if (!confirmed) return;

    setBusyId(item.id);
    try {
      await completeMut({ jobId: item.job_id, assignmentId: item.id });
      showMessage('¡Servicio finalizado!', 'La chamba fue marcada como completada.');
      setAgendaFilter('historial');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo finalizar';
      showMessage('Error', msg);
    } finally {
      setBusyId(null);
    }
  }, [completeMut]);

  const openAssignment = useCallback((item: JobAssignment) => {
    if (!item.job_id) return;
    const status = item.job?.status;
    if (
      status === 'taken'
      || status === 'in_progress'
      || status === 'completed'
    ) {
      navigation.navigate('JobFeed', {
        screen: 'JobActive',
        params: { jobId: item.job_id },
      });
      return;
    }
    navigation.navigate('JobFeed', {
      screen: 'JobDetail',
      params: { jobId: item.job_id },
    });
  }, [navigation]);

  const openJobChat = useCallback(async (item: JobAssignment, readOnly: boolean) => {
    if (!item.job_id) return;
    const currentProfile = useAuthStore.getState().profile;
    if (!currentProfile) return;
    const ready = await ensureChatSessionForProfile(currentProfile);
    if (!ready) {
      showChatSessionRequiredAlert();
      return;
    }
    navigation.navigate('JobFeed', {
      screen: 'JobChat',
      params: {
        jobId: item.job_id,
        clientId: item.job?.created_by,
        readOnly,
      },
    });
  }, [navigation]);

  const listEmpty = agendaFilter === 'activas' ? (
    <EmptyState
      icon="flash-outline"
      title="Sin chambas activas"
      subtitle="Tus postulaciones pendientes y chambas en curso aparecen aquí."
    />
  ) : (
    <EmptyState
      icon="archive-outline"
      title="Sin historial aún"
      subtitle="Tus chambas completadas o canceladas se listarán en esta sección."
    />
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <WorkerTopBar avatarName="CHAMBA" />

      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>Agenda</Text>
        <Text style={styles.headerTitle}>Mis Chambas</Text>
        <Text style={styles.headerSubtitle}>
          Gestioná trabajos en curso y revisá tu historial
        </Text>

        <ChambaSlidingToggle
          options={filterTabs}
          active={agendaFilter}
          onChange={setAgendaFilter}
          style={styles.agendaToggle}
        />

        {agendaFilter === 'activas' && activeAssignments.length > 0 && (
          <Text style={styles.sectionHint}>
            {activeAssignments.every(isWorkerPendingClientSelection)
              ? activeAssignments.length === 1
                ? '1 postulación esperando que el cliente te elija'
                : `${activeAssignments.length} postulaciones esperando al cliente`
              : activeAssignments.length === 1
                ? '1 chamba en curso — actualizá el estado desde la tarjeta'
                : `${activeAssignments.length} chambas activas (postulaciones o en curso)`}
          </Text>
        )}
        {agendaFilter === 'historial' && historyAssignments.length > 0 && (
          <Text style={styles.sectionHint}>
            Servicios finalizados o cancelados
          </Text>
        )}

        {!!error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No se pudo cargar tu agenda</Text>
            <Text style={styles.errorSub}>Verifica tu sesión y vuelve a intentar.</Text>
            <TouchableOpacity onPress={() => refetch()}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={M3.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleAssignments}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <AssignmentCard
              assignment={item}
              variant={agendaFilter}
              onPress={() => openAssignment(item)}
              onOpenChat={(readOnly) => openJobChat(item, readOnly)}
              onAdvance={(phase) => { void handleAdvance(item, phase); }}
              onFinalize={() => { void handleFinalize(item); }}
              isBusy={busyId === item.id && (isCompleting || isAdvancing)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={M3.primary} />
          }
          ListEmptyComponent={listEmpty}
        />
      )}
    </View>
  );
};

const AssignmentCard: React.FC<{
  assignment: JobAssignment;
  variant: AgendaFilter;
  onPress: () => void;
  onOpenChat?: (readOnly: boolean) => void;
  onAdvance: (phase: WorkerOperationalPhase) => void;
  onFinalize: () => void;
  isBusy?: boolean;
}> = ({
  assignment,
  variant,
  onPress,
  onOpenChat,
  onAdvance,
  onFinalize,
  isBusy = false,
}) => {
  const job = assignment.job;
  const hasJob = !!job;
  const title = job?.title ?? `Trabajo ${assignment.job_id.slice(0, 8)}`;
  const isHistory = variant === 'historial';
  const subtitle = job?.category
    ? `${getCategoryLabel(job.category)} · ${formatDate(assignment.assigned_at)}`
    : `Aceptado el ${formatDate(assignment.assigned_at)}`;

  const paymentColor =
    assignment.payment_status === 'paid'
      ? M3.secondary
      : assignment.payment_status === 'failed'
      ? M3.error
      : M3.tertiary;

  const paymentLabel =
    assignment.payment_status === 'paid'
      ? 'Pagado'
      : assignment.payment_status === 'processing'
      ? 'Procesando'
      : assignment.payment_status === 'failed'
      ? 'Fallido'
      : 'Pendiente';

  const category = job?.category ?? '';
  const awaitingClient = !isHistory && isWorkerPendingClientSelection(assignment);
  const showStepper = !isHistory && hasJob && isActiveOperationalJob(job) && !awaitingClient;
  const canChat =
    !!onOpenChat &&
    showJobChatEntry(job?.status) &&
    !awaitingClient;
  const chatReadOnly = job?.status === 'completed';

  return (
    <View style={[styles.card, isHistory && styles.cardHistory]}>
      <ChambaPressable onPress={onPress} style={styles.cardPressBody}>
        <View style={styles.cardRow}>
          <View style={styles.cardContent}>
            <View style={styles.badgeRow}>
              {job?.status ? <StatusBadge status={job.status} size="sm" /> : null}
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
            <Text style={styles.cardPrice}>
              {hasJob ? formatCurrency(job.worker_payout ?? 0) : '—'}
            </Text>
            {!isHistory && !awaitingClient && (
              <Text style={[styles.paymentLabel, { color: paymentColor }]}>{paymentLabel}</Text>
            )}
            {awaitingClient && (
              <Text style={styles.pendingClientText}>
                Postulación enviada — el cliente revisará tu perfil
              </Text>
            )}
          </View>

          {category ? (
            <CategoryIconCircle category={category} />
          ) : (
            <View style={[chambaStyles.iconCircleRight, styles.fallbackIcon]}>
              <Ionicons name="receipt-outline" size={22} color="#FFF" />
            </View>
          )}
        </View>
      </ChambaPressable>

      {canChat && !showStepper && (
        <JobChatEntryButton
          variant="worker"
          readOnly={chatReadOnly}
          fullWidth
          onPress={() => onOpenChat!(chatReadOnly)}
        />
      )}

      {showStepper && job && (
        <JobOperationalStepper
          job={job}
          onAdvance={onAdvance}
          onFinalize={onFinalize}
          onOpenChat={
            canChat ? () => onOpenChat!(chatReadOnly) : undefined
          }
          isAdvancing={isBusy}
          showQuickActions={false}
          compact
        />
      )}

      {isHistory && (
        <ChambaPressable onPress={onPress} style={styles.historyFooterPress}>
          <View style={styles.historyFooter}>
            <Ionicons name="chevron-forward" size={16} color={CHAMBA.muted} />
            <Text style={styles.historyFooterText}>Ver detalle</Text>
          </View>
        </ChambaPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  header: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  headerEyebrow: {
    fontSize: 12,
    color: CHAMBA.muted,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: CHAMBA.navy,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: CHAMBA.muted,
    marginTop: 4,
    marginBottom: 4,
  },
  agendaToggle: { marginTop: SPACING.md, marginBottom: 8 },
  sectionHint: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  errorCard: {
    marginTop: SPACING.md,
    backgroundColor: M3.errorContainer,
    borderRadius: 12,
    padding: SPACING.md,
    gap: 8,
  },
  errorTitle: { color: M3.onErrorContainer, fontSize: 14, fontWeight: '700' },
  errorSub: { color: M3.onErrorContainer, fontSize: 12, opacity: 0.85 },
  retryText: { color: M3.error, fontSize: 14, fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: 100, flexGrow: 1 },
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: SPACING.md,
    marginBottom: 14,
    ...CARD_ELEVATION,
  },
  cardPressBody: {
    margin: -SPACING.md,
    padding: SPACING.md,
  },
  cardHistory: {
    borderWidth: 1,
    borderColor: CHAMBA.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  badgeRow: {
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CHAMBA.navy,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: CHAMBA.muted,
    fontWeight: '400',
    marginBottom: 6,
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  fallbackIcon: {
    backgroundColor: '#007AFF',
  },
  paymentLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  pendingClientText: {
    fontSize: 12,
    fontWeight: '600',
    color: M3.primary,
    marginTop: 6,
    lineHeight: 17,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
  },
  historyFooterPress: {
    marginTop: 10,
  },
  historyFooterText: {
    fontSize: 12,
    fontWeight: '600',
    color: CHAMBA.muted,
  },
});
