import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking,
  StyleSheet, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@components/Avatar';
import { StatusBadge } from '@components/Badge';
import { EmptyState } from '@components/EmptyState';
import { MaterialSymbol } from '@components/admin/MaterialSymbol';
import { AdminMetricCard } from '@components/admin/AdminMetricCard';
import { useAuthStore } from '@store/authStore';
import {
  fetchAdminJobs, fetchAllWorkers,
  type AdminJob, type AdminAssignment,
} from '../services/adminService';
import {
  M3, SPACING, BORDER_RADIUS, CARD_ELEVATION, stitchTypography,
} from '@constants/stitchStyles';
import {
  formatCurrency, formatRelativeTime,
  getCategoryEmoji, getCategoryLabel,
} from '@utils/formatters';
import type { JobStackParamList, UserProfile } from '@/types';

type Nav = NativeStackNavigationProp<JobStackParamList>;

type TabId = 'open' | 'active' | 'completed';

interface Tab { id: TabId; label: string; icon: string }

const TABS: Tab[] = [
  { id: 'open',      label: 'Subastas',    icon: 'radar' },
  { id: 'active',    label: 'En Curso',    icon: 'schedule' },
  { id: 'completed', label: 'Finalizadas', icon: 'task_alt' },
];

// ─── Centro de Control Ejecutivo ─────────────────────────────────────────────

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const profile    = useAuthStore((s) => s.profile);
  const [activeTab, setActiveTab] = useState<TabId>('active');

  const { data, isLoading, refetch, isRefetching } = useQuery<AdminJob[]>({
    queryKey: ['admin', 'control', 'jobs'],
    queryFn:  fetchAdminJobs,
    refetchInterval: 30_000,
  });
  const jobs: AdminJob[] = data ?? [];

  const { data: workersData } = useQuery({
    queryKey: ['admin', 'workers'],
    queryFn:  fetchAllWorkers,
    refetchInterval: 30_000,
  });
  const workers = workersData ?? [];

  const grouped = useMemo(() => ({
    open:      jobs.filter((j) => j.status === 'open'),
    active:    jobs.filter((j) => j.status === 'taken' || j.status === 'in_progress'),
    completed: jobs.filter((j) => j.status === 'completed' || j.status === 'cancelled'),
  }), [jobs]);

  const displayJobs = grouped[activeTab];

  const metrics = useMemo(() => {
    const completedOnly = jobs.filter((j) => j.status === 'completed');
    const totalVolume = completedOnly.reduce((sum, j) => sum + (j.pay_amount ?? 0), 0);
    const connectedTechs = workers.filter(
      (w: UserProfile) => w.is_approved && w.worker_status === 'active',
    ).length;

    return {
      totalVolume,
      activeAuctions: grouped.open.length,
      connectedTechs,
      finishedChambas: completedOnly.length,
    };
  }, [jobs, grouped.open.length, workers]);

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      {/* Top bar ejecutivo */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.execBadge}>
            <MaterialSymbol name="monitor_heart" size={20} color={M3.onPrimaryContainer} filled />
          </View>
          <View>
            <Text style={styles.eyebrow}>Centro de Control Ejecutivo</Text>
            <Text style={styles.greeting}>
              {profile?.full_name?.split(' ')[0] ?? 'Administrador'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}>
          {isRefetching
            ? <ActivityIndicator size="small" color={M3.primary} />
            : <MaterialSymbol name="radar" size={22} color={M3.primary} />
          }
        </TouchableOpacity>
      </View>

      {/* Bento grid métricas */}
      <View style={styles.bentoGrid}>
        <AdminMetricCard
          icon="payments"
          label="Volumen Total Transaccionado"
          value={formatCurrency(metrics.totalVolume)}
          accent={M3.primary}
          wide
        />
        <View style={styles.bentoRow}>
          <AdminMetricCard
            icon="radar"
            label="Subastas Activas en el Radar"
            value={String(metrics.activeAuctions)}
            accent={M3.tertiaryContainer}
          />
          <AdminMetricCard
            icon="groups"
            label="Técnicos Conectados en Tiempo Real"
            value={String(metrics.connectedTechs)}
            accent={M3.secondary}
          />
        </View>
        <AdminMetricCard
          icon="task_alt"
          label="Chambas Finalizadas"
          value={String(metrics.finishedChambas)}
          accent={M3.onSecondaryFixedVariant}
          wide
        />
      </View>

      {/* Consola radar — tabs */}
      <View style={styles.radarConsole}>
        <View style={styles.radarHeader}>
          <MaterialSymbol name="filter_alt" size={18} color={M3.primary} />
          <Text style={styles.radarTitle}>Radar de Operaciones</Text>
        </View>
        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count    = grouped[tab.id].length;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tab, isActive && styles.tabActive]}
                activeOpacity={0.85}
              >
                <MaterialSymbol
                  name={tab.icon}
                  size={16}
                  color={isActive ? M3.onPrimaryContainer : M3.onSurfaceVariant}
                  filled={isActive}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={M3.primary} />
          <Text style={styles.loadingText}>Sincronizando centro de control…</Text>
        </View>
      ) : (
        <FlatList
          data={displayJobs}
          keyExtractor={(j) => j.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 100 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={M3.primary}
            />
          }
          renderItem={({ item }) => (
            <AdminJobCard
              job={item}
              tab={activeTab}
              onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="briefcase-outline"
                title={`Sin chambas ${
                  activeTab === 'open'      ? 'en subasta'  :
                  activeTab === 'active'    ? 'en curso'    : 'finalizadas'
                }`}
                subtitle="El radar no detecta actividad en esta categoría."
              />
            </View>
          }
        />
      )}
    </View>
  );
};

// ─── Admin Job Card (Stitch) ──────────────────────────────────────────────────

interface AdminJobCardProps {
  job: AdminJob;
  tab: TabId;
  onPress: () => void;
}

const AdminJobCard: React.FC<AdminJobCardProps> = ({ job, tab, onPress }) => {
  const assignment: AdminAssignment | undefined = job.assignments?.[0];
  const worker = assignment?.worker;

  const handleCallWorker = () => {
    if (!worker?.phone) {
      Alert.alert('Sin número', 'El trabajador no tiene número registrado.');
      return;
    }
    Linking.openURL(`tel:${worker.phone}`).catch(() =>
      Alert.alert('Error', 'No se pudo abrir el marcador.'),
    );
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.jobCard}>
      <View style={styles.jobTopRow}>
        <View style={styles.catIcon}>
          <Text style={{ fontSize: 20 }}>{getCategoryEmoji(job.category)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>
          <Text style={styles.jobMeta}>
            {getCategoryLabel(job.category)} · {formatRelativeTime(job.created_at)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.jobPay}>{formatCurrency(job.pay_amount)}</Text>
          <StatusBadge status={job.status} size="sm" />
        </View>
      </View>

      <View style={styles.locationRow}>
        <MaterialSymbol name="location_on" size={14} color={M3.outline} />
        <Text style={styles.locationText} numberOfLines={1}>
          {job.location?.address ?? '—'}
        </Text>
      </View>

      {tab === 'active' && worker && (
        <>
          <View style={styles.divider} />
          <View style={styles.workerRow}>
            <Avatar uri={worker.avatar_url ?? null} name={worker.full_name ?? '?'} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.workerName}>{worker.full_name}</Text>
              <Text style={styles.workerStatus}>
                {job.status === 'completed' ? 'Finalizado' : 'En proceso'}
              </Text>
            </View>
            {worker.phone && (
              <TouchableOpacity onPress={handleCallWorker} style={styles.callBtn}>
                <MaterialSymbol name="call" size={16} color={M3.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.moneyCard}>
            <MoneyRow label="Total pagado por cliente" value={formatCurrency(job.pay_amount)} />
            <MoneyRow
              label="Comisión plataforma (5%)"
              value={formatCurrency(job.platform_fee)}
              valueColor={M3.primaryContainer}
              bold
            />
            <View style={styles.dividerThin} />
            <MoneyRow
              label="A transferir al trabajador (95%)"
              value={formatCurrency(job.worker_payout)}
              valueColor={M3.tertiary}
            />
          </View>
        </>
      )}

      {tab === 'completed' && job.status === 'completed' && (
        <>
          <View style={styles.divider} />
          <View style={styles.completedRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {worker && (
                <Avatar uri={worker.avatar_url ?? null} name={worker.full_name ?? '?'} size={26} />
              )}
              <Text style={styles.completedWorker}>
                {worker?.full_name ?? 'Trabajador'}
              </Text>
            </View>
            <Text style={styles.completedFee}>
              Comisión: {formatCurrency(job.platform_fee)}
            </Text>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

const MoneyRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}> = ({ label, value, valueColor = M3.onBackground, bold = false }) => (
  <View style={styles.moneyRow}>
    <Text style={styles.moneyLabel}>{label}</Text>
    <Text style={[styles.moneyValue, { color: valueColor, fontWeight: bold ? '800' : '600' }]}>
      {value}
    </Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: M3.background,
  },
  center: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.sm,
  },
  loadingText: {
    ...stitchTypography.bodySm,
    color: M3.onSurfaceVariant,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    flexGrow:          1,
  },
  headerBlock: {
    gap: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  topBar: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm + 4,
    flex:          1,
  },
  execBadge: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: M3.primaryContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  eyebrow: {
    ...stitchTypography.labelBold,
    color:         M3.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  greeting: {
    ...stitchTypography.headlineLg,
    fontSize: 22,
  },
  refreshBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: M3.surfaceContainerLowest,
    alignItems:      'center',
    justifyContent:  'center',
    ...CARD_ELEVATION,
  },
  bentoGrid: {
    gap: SPACING.sm + 4,
  },
  bentoRow: {
    flexDirection: 'row',
    gap:           SPACING.sm + 4,
  },
  radarConsole: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius:    12,
    overflow:        'hidden',
    ...CARD_ELEVATION,
  },
  radarHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    paddingTop:        SPACING.md,
    paddingBottom:     SPACING.xs,
  },
  radarTitle: {
    ...stitchTypography.headlineMdMobile,
    fontSize: 16,
  },
  tabRow: {
    flexDirection: 'row',
    borderTopWidth:  1,
    borderTopColor:  M3.surfaceVariant,
  },
  tab: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               4,
    paddingVertical:   SPACING.sm + 2,
    paddingHorizontal: 4,
  },
  tabActive: {
    backgroundColor: M3.primaryContainer,
  },
  tabLabel: {
    ...stitchTypography.labelBold,
    color: M3.onSurfaceVariant,
  },
  tabLabelActive: {
    color: M3.onPrimaryContainer,
  },
  tabBadge: {
    backgroundColor:   M3.surfaceContainer,
    borderRadius:      10,
    paddingHorizontal: 5,
    paddingVertical:   1,
    minWidth:          18,
    alignItems:        'center',
  },
  tabBadgeActive: {
    backgroundColor: M3.primaryFixed,
  },
  tabBadgeText: {
    fontSize:   10,
    fontWeight: '700',
    color:      M3.onSurfaceVariant,
  },
  tabBadgeTextActive: {
    color: M3.onPrimaryFixedVariant,
  },
  jobCard: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius:    12,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm + 4,
    ...CARD_ELEVATION,
  },
  jobTopRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           SPACING.sm,
  },
  catIcon: {
    width:           42,
    height:          42,
    borderRadius:    10,
    backgroundColor: M3.surfaceContainer,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  jobTitle: {
    ...stitchTypography.headlineMdMobile,
    fontSize: 15,
    marginBottom: 3,
  },
  jobMeta: {
    ...stitchTypography.labelBold,
    color: M3.outline,
  },
  jobPay: {
    fontSize:   18,
    fontWeight: '800',
    color:      M3.primaryContainer,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     SPACING.sm,
  },
  locationText: {
    ...stitchTypography.bodySm,
    flex: 1,
  },
  divider: {
    height:          1,
    backgroundColor: M3.surfaceVariant,
    marginVertical:  SPACING.sm,
  },
  dividerThin: {
    height:          1,
    backgroundColor: M3.surfaceVariant,
    marginVertical:  4,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  workerName: {
    ...stitchTypography.bodyLg,
    fontWeight: '700',
    fontSize:   14,
  },
  workerStatus: {
    ...stitchTypography.labelBold,
    color:     M3.outline,
    marginTop: 1,
  },
  callBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: M3.primaryFixed,
    alignItems:      'center',
    justifyContent:  'center',
  },
  moneyCard: {
    backgroundColor: M3.surfaceContainerLow,
    borderRadius:    BORDER_RADIUS.md,
    padding:         SPACING.md,
    marginTop:       SPACING.sm,
    gap:             6,
  },
  moneyRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  moneyLabel: {
    ...stitchTypography.labelBold,
    flex: 1,
  },
  moneyValue: {
    fontSize: 14,
  },
  completedRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  completedWorker: {
    ...stitchTypography.labelBold,
    color: M3.onSurfaceVariant,
  },
  completedFee: {
    ...stitchTypography.labelBold,
    color:      M3.primaryContainer,
    fontWeight: '700',
  },
  emptyWrap: {
    paddingVertical: SPACING.xl,
  },
});
