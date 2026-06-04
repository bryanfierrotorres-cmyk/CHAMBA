import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
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
import { M3, SPACING, CARD_ELEVATION, stitchTypography } from '@constants/stitchStyles';
import { CHAMBA, chambaStyles } from '@constants/chambaUI';
import { CategoryIconCircle } from '@utils/categoryVisual';
import {
  formatCurrency, formatDate, getCategoryLabel,
} from '@utils/formatters';
import { confirmAction, showMessage } from '@utils/confirmAction';
import {
  isActiveOperationalJob,
  getPhaseAction,
  resolveOperationalPhase,
} from '@utils/workerOperationalPhase';
import type { WorkerTabParamList, JobAssignment, WorkerOperationalPhase } from '@/types';

type Nav = BottomTabNavigationProp<WorkerTabParamList, 'MyJobs'>;

export const MyJobsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
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

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        void refreshStore(profile.id);
      }
    }, [refreshStore, profile?.id]),
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo finalizar';
      showMessage('Error', msg);
    } finally {
      setBusyId(null);
    }
  }, [completeMut]);

  const totalEarned = assignments
    .filter((a) => a.payment_status === 'paid')
    .reduce((sum, a) => sum + (a.job?.worker_payout ?? 0), 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <WorkerTopBar avatarName="CHAMBA" />

      <View style={styles.header}>
        <Text style={stitchTypography.bodySm}>Agenda</Text>
        <Text style={stitchTypography.headlineLg}>Mis Chambas</Text>

        {totalEarned > 0 && (
          <View style={styles.walletCard}>
            <Ionicons name="wallet-outline" size={22} color={M3.onSecondaryContainer} />
            <View>
              <Text style={styles.walletLabel}>Total ganado</Text>
              <Text style={styles.walletAmount}>{formatCurrency(totalEarned)}</Text>
            </View>
          </View>
        )}

        {!!error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No se pudo cargar tu historial</Text>
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
          data={assignments}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <AssignmentCard
              assignment={item}
              onPress={() => {
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
              }}
              onAdvance={(phase) => { void handleAdvance(item, phase); }}
              onFinalize={() => { void handleFinalize(item); }}
              isBusy={busyId === item.id && (isCompleting || isAdvancing)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={M3.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="briefcase-outline"
              title="Sin chambas aún"
              subtitle="Acepta tu primera chamba y aparecerá aquí"
            />
          }
        />
      )}
    </View>
  );
};

const AssignmentCard: React.FC<{
  assignment: JobAssignment;
  onPress: () => void;
  onAdvance: (phase: WorkerOperationalPhase) => void;
  onFinalize: () => void;
  isBusy?: boolean;
}> = ({
  assignment, onPress, onAdvance, onFinalize, isBusy = false,
}) => {
  const job = assignment.job;
  const hasJob = !!job;
  const title = job?.title ?? `Trabajo ${assignment.job_id.slice(0, 8)}`;
  const subtitle = job?.category
    ? `${getCategoryLabel(job.category)} • ${formatDate(assignment.assigned_at)}`
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
  const showStepper = hasJob && isActiveOperationalJob(job);

  return (
    <ChambaPressable onPress={onPress} style={styles.card}>
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
          <Text style={[styles.paymentLabel, { color: paymentColor }]}>{paymentLabel}</Text>
        </View>

        {category ? (
          <CategoryIconCircle category={category} />
        ) : (
          <View style={[chambaStyles.iconCircleRight, styles.fallbackIcon]}>
            <Ionicons name="receipt-outline" size={22} color="#FFF" />
          </View>
        )}
      </View>

      {showStepper && job && (
        <JobOperationalStepper
          job={job}
          onAdvance={onAdvance}
          onFinalize={onFinalize}
          isAdvancing={isBusy}
          compact
        />
      )}
    </ChambaPressable>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  header: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  walletCard: {
    marginTop: SPACING.md,
    backgroundColor: M3.secondaryContainer,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...CARD_ELEVATION,
  },
  walletLabel: { color: M3.onSecondaryContainer, fontSize: 12, fontWeight: '700' },
  walletAmount: { color: M3.onSecondaryFixed, fontSize: 24, fontWeight: '700' },
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
});
