import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerTopBar } from '@components/worker/WorkerTopBar';
import { WorkerWalletCard } from '@components/worker/WorkerWalletCard';
import { ChambaSlidingToggle } from '@components/chamba/ChambaSlidingToggle';
import { EmptyState } from '@components/EmptyState';
import { useMyJobs } from '../hooks/useJobs';
import { useAssignmentsStore } from '@store/assignmentsStore';
import { useAuthStore } from '@store/authStore';
import { CHAMBA, CARD_STEP_SHADOW } from '@constants/chambaUI';
import { M3, SPACING } from '@constants/stitchStyles';
import { formatCurrency, formatDate, getCategoryLabel } from '@utils/formatters';
import { computeWorkerWalletSummary } from '@utils/workerWalletSummary';
import {
  buildWorkerWalletTransactions,
  getWalletChartSeriesOrPlaceholder,
  type WalletChartPeriod,
} from '@utils/workerWalletChartData';
import type { JobAssignment } from '@/types';

const PERIOD_TABS = [
  { id: 'day' as const, label: 'Día' },
  { id: 'week' as const, label: 'Semana' },
  { id: 'month' as const, label: 'Mes' },
];

const CHART_HEIGHT = 220;

export const WalletScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
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
  const [period, setPeriod] = useState<WalletChartPeriod>('week');

  const walletSummary = useMemo(
    () => computeWorkerWalletSummary(assignments),
    [assignments],
  );

  const chartSeries = useMemo(
    () => getWalletChartSeriesOrPlaceholder(assignments, period),
    [assignments, period],
  );

  const transactions = useMemo(
    () => buildWorkerWalletTransactions(assignments),
    [assignments],
  );

  const chartWidth = Math.max(windowWidth - SPACING.md * 2 - 36, 280);

  const chartConfig = useMemo(
    () => ({
      backgroundColor: CHAMBA.white,
      backgroundGradientFrom: CHAMBA.white,
      backgroundGradientTo: CHAMBA.white,
      decimalPlaces: 0,
      color: (opacity = 1) => {
        const hex = CHAMBA.primary;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      },
      labelColor: () => CHAMBA.muted,
      propsForDots: {
        r: chartSeries.hasRealData ? '4' : '0',
        strokeWidth: '2',
        stroke: CHAMBA.primary,
      },
      propsForBackgroundLines: {
        strokeDasharray: '',
        stroke: CHAMBA.border,
      },
    }),
    [chartSeries.hasRealData],
  );

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        void refreshStore(profile.id);
      }
    }, [refreshStore, profile?.id]),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <WorkerTopBar avatarName="CHAMBA" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={M3.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>Billetera</Text>
          <Text style={styles.headerTitle}>Tu saldo CHAMBA</Text>
          <Text style={styles.balanceLabel}>Saldo total acreditado</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(walletSummary.totalPaid)}</Text>
          <Text style={styles.balanceHint}>
            {walletSummary.paidCount > 0
              ? `${walletSummary.paidCount} pago${walletSummary.paidCount === 1 ? '' : 's'} confirmado${walletSummary.paidCount === 1 ? '' : 's'}`
              : 'Completa chambas para ver ingresos acreditados'}
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No se pudo cargar tu billetera</Text>
            <Text style={styles.errorSub}>Verifica tu sesión y vuelve a intentar.</Text>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={M3.primary} />
          </View>
        ) : (
          <>
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Tendencia de ingresos</Text>
              <ChambaSlidingToggle
                options={PERIOD_TABS}
                active={period}
                onChange={setPeriod}
                style={styles.periodToggle}
              />

              {!chartSeries.hasRealData && (
                <View style={styles.chartPlaceholderBanner}>
                  <Ionicons name="analytics-outline" size={18} color={CHAMBA.muted} />
                  <Text style={styles.chartPlaceholderText}>
                    Aún no hay suficientes pagos para mostrar tendencia real
                  </Text>
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={{
                    labels: chartSeries.labels,
                    datasets: [{ data: chartSeries.values.length > 0 ? chartSeries.values : [0] }],
                  }}
                  width={Math.max(chartWidth, chartSeries.labels.length * 52)}
                  height={CHART_HEIGHT}
                  chartConfig={chartConfig}
                  bezier={chartSeries.hasRealData}
                  withInnerLines
                  withOuterLines={false}
                  fromZero
                  style={styles.chart}
                  segments={4}
                />
              </ScrollView>
            </View>

            <WorkerWalletCard summary={walletSummary} breakdownOnly />

            <View style={styles.transactionsSection}>
              <Text style={styles.sectionTitle}>Histórico de transacciones</Text>
              {transactions.length === 0 ? (
                <EmptyState
                  icon="wallet-outline"
                  title="Sin transacciones aún"
                  subtitle="Los pagos acreditados de tus chambas completadas aparecerán aquí."
                />
              ) : (
                transactions.map((item) => (
                  <TransactionRow key={item.id} assignment={item} />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const TransactionRow: React.FC<{ assignment: JobAssignment }> = ({ assignment }) => {
  const job = assignment.job;
  const title = job?.title ?? `Trabajo ${assignment.job_id.slice(0, 8)}`;
  const subtitle = job?.category
    ? getCategoryLabel(job.category)
    : 'Servicio completado';
  const paidAt = assignment.completed_at ?? assignment.assigned_at;

  return (
    <View style={styles.transactionRow}>
      <View style={styles.transactionIcon}>
        <Ionicons name="checkmark-circle" size={20} color={CHAMBA.primary} />
      </View>
      <View style={styles.transactionContent}>
        <Text style={styles.transactionTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.transactionSubtitle}>
          {subtitle} · {formatDate(paidAt)}
        </Text>
      </View>
      <Text style={styles.transactionAmount}>
        +{formatCurrency(job?.worker_payout ?? 0)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 120,
  },
  header: {
    paddingTop: 4,
    paddingBottom: SPACING.md,
  },
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
  balanceLabel: {
    marginTop: 16,
    fontSize: 13,
    color: CHAMBA.muted,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: CHAMBA.primary,
    letterSpacing: -1,
    marginTop: 4,
  },
  balanceHint: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 6,
    lineHeight: 17,
  },
  errorCard: {
    marginBottom: SPACING.md,
    backgroundColor: M3.errorContainer,
    borderRadius: 12,
    padding: SPACING.md,
    gap: 6,
  },
  errorTitle: { color: M3.onErrorContainer, fontSize: 14, fontWeight: '700' },
  errorSub: { color: M3.onErrorContainer, fontSize: 12, opacity: 0.85 },
  loading: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    ...CARD_STEP_SHADOW,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CHAMBA.navy,
    marginBottom: 12,
  },
  periodToggle: { marginBottom: 12 },
  chartPlaceholderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  chartPlaceholderText: {
    flex: 1,
    fontSize: 12,
    color: CHAMBA.muted,
    lineHeight: 17,
  },
  chart: {
    marginLeft: -8,
    borderRadius: 12,
  },
  transactionsSection: {
    marginTop: 18,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CHAMBA.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...CARD_STEP_SHADOW,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionContent: { flex: 1, minWidth: 0 },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CHAMBA.navy,
  },
  transactionSubtitle: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
});
