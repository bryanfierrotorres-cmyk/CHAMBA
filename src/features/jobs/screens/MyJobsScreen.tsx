import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBadge } from '@components/Badge';
import { EmptyState } from '@components/EmptyState';
import { WorkerTopBar } from '@components/worker/WorkerTopBar';
import { useMyJobs, useCompleteJob } from '../hooks/useJobs';
import { useAssignmentsStore } from '@store/assignmentsStore';
import { useAuthStore } from '@store/authStore';
import { M3, SPACING, CARD_ELEVATION, stitchTypography, stitchLayout } from '@constants/stitchStyles';
import {
  formatCurrency, formatDate, getCategoryEmoji, getCategoryLabel,
} from '@utils/formatters';
import { confirmAction, showMessage } from '@utils/confirmAction';
import type { WorkerTabParamList, JobAssignment } from '@/types';

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
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        void refreshStore(profile.id);
      }
    }, [refreshStore, profile?.id]),
  );

  const handleFinalize = useCallback(async (item: JobAssignment) => {
    const confirmed = await confirmAction({
      title: '¿Finalizar servicio?',
      message: 'El cliente y el administrador verán el estado Finalizado en su historial.',
      confirmLabel: 'Finalizar',
      destructive: true,
    });
    if (!confirmed) return;

    setFinalizingId(item.id);
    try {
      await completeMut({ jobId: item.job_id, assignmentId: item.id });
      showMessage('¡Servicio finalizado!', 'La chamba fue marcada como completada.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo finalizar';
      showMessage('Error', msg);
    } finally {
      setFinalizingId(null);
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
                if (status === 'taken' || status === 'in_progress') {
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
              onFinalize={
                item.job?.status === 'in_progress' || item.job?.status === 'taken'
                  ? () => { void handleFinalize(item); }
                  : undefined
              }
              isFinalizing={finalizingId === item.id || isCompleting}
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
  onFinalize?: () => void;
  isFinalizing?: boolean;
}> = ({
  assignment, onPress, onFinalize, isFinalizing = false,
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

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.card}>
      <View style={styles.cardRow}>
        <View style={stitchLayout.iconCircleSm}>
          <Text style={{ fontSize: 20 }}>{job?.category ? getCategoryEmoji(job.category) : '🧾'}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={stitchTypography.headlineMdMobile} numberOfLines={1}>{title}</Text>
          <Text style={stitchTypography.bodySm}>{subtitle}</Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.priceValue}>
            {hasJob ? formatCurrency(job.worker_payout ?? 0) : '—'}
          </Text>
          <Text style={[styles.paymentLabel, { color: paymentColor }]}>{paymentLabel}</Text>
        </View>
      </View>

      <View style={{ marginTop: SPACING.sm }}>
        {job?.status ? <StatusBadge status={job.status} size="sm" /> : null}
      </View>

      {onFinalize && (
        <TouchableOpacity
          onPress={onFinalize}
          disabled={isFinalizing}
          style={[styles.finalizeBtn, isFinalizing && styles.finalizeBtnDisabled]}
        >
          {isFinalizing
            ? <ActivityIndicator color={M3.onPrimary} size="small" />
            : <Text style={styles.finalizeText}>Marcar como Finalizado</Text>
          }
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: M3.background },
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
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm + 4,
    ...CARD_ELEVATION,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  paymentLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  priceValue: { fontSize: 18, fontWeight: '700', color: M3.secondary },
  finalizeBtn: {
    marginTop: SPACING.sm,
    backgroundColor: M3.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 42,
    justifyContent: 'center',
  },
  finalizeBtnDisabled: { opacity: 0.7 },
  finalizeText: { color: M3.onPrimary, fontWeight: '700', fontSize: 14 },
});
