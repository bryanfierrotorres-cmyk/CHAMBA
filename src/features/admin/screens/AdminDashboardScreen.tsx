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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { StatusBadge } from '@components/Badge';
import { AdminMetricCard } from '@components/admin/AdminMetricCard';
import { useAuthStore } from '@store/authStore';
import {
  fetchAdminJobs, fetchAllWorkers,
  type AdminJob, type AdminAssignment,
} from '../services/adminService';
import { ChambaGradientTabs } from '@components/chamba/ChambaGradientTabs';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import {
  formatCurrency, formatRelativeTime, getCategoryLabel,
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

const jobCategoryVisual = (category: string): { color: string; icon: React.ReactNode } => {
  const slug = category.toLowerCase();
  if (slug.includes('sofa') || slug.includes('limpieza')) {
    return { color: '#5856D6', icon: <MaterialCommunityIcons name="sofa" size={22} color="#FFF" /> };
  }
  if (slug.includes('vehiculo') || slug.includes('car')) {
    return { color: '#007AFF', icon: <Ionicons name="car-sport" size={22} color="#FFF" /> };
  }
  if (slug.includes('jardiner')) {
    return { color: '#34C759', icon: <Ionicons name="leaf" size={22} color="#FFF" /> };
  }
  return { color: '#FF9500', icon: <Ionicons name="briefcase" size={22} color="#FFF" /> };
};

// ─── Centro de Control Ejecutivo ─────────────────────────────────────────────

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const profile    = useAuthStore((s) => s.profile);
  const [activeTab, setActiveTab] = useState<TabId>('active');

  const { data, isLoading, refetch, isRefetching } = useQuery<AdminJob[]>({
    queryKey: ['admin', 'control', 'jobs'],
    queryFn:  fetchAdminJobs,
    staleTime: 45_000,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
  const jobs: AdminJob[] = data ?? [];

  const { data: workersData } = useQuery({
    queryKey: ['admin', 'workers'],
    queryFn:  fetchAllWorkers,
    staleTime: 60_000,
    refetchInterval: 90_000,
    enabled: !isLoading,
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
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={chambaStyles.screenTitle}>Centro de Control</Text>
          <Text style={chambaStyles.screenSubtitle}>
            Hola, {profile?.full_name?.split(' ')[0] ?? 'Administrador'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}>
          {isRefetching
            ? <ActivityIndicator size="small" color={CHAMBA.blue} />
            : <Ionicons name="refresh-outline" size={22} color={CHAMBA.blue} />
          }
        </TouchableOpacity>
      </View>

      <View style={styles.bentoGrid}>
        <AdminMetricCard
          icon="payments"
          label="Volumen Total Transaccionado"
          value={formatCurrency(metrics.totalVolume)}
          accent="#007AFF"
          wide
        />
        <View style={styles.bentoRow}>
          <AdminMetricCard
            icon="radar"
            label="Subastas Activas"
            value={String(metrics.activeAuctions)}
            accent="#FF9500"
          />
          <AdminMetricCard
            icon="groups"
            label="Técnicos Conectados"
            value={String(metrics.connectedTechs)}
            accent="#34C759"
          />
        </View>
        <AdminMetricCard
          icon="task_alt"
          label="Chambas Finalizadas"
          value={String(metrics.finishedChambas)}
          accent="#5856D6"
          wide
        />
      </View>

      <Text style={[chambaStyles.sectionTitle, { marginBottom: 10 }]}>Radar de Operaciones</Text>
      <ChambaGradientTabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, badge: grouped[t.id].length }))}
        active={activeTab}
        onChange={setActiveTab}
      />
    </View>
  );

  const listEmpty = isLoading && jobs.length === 0 ? (
    <View style={[styles.center, { paddingVertical: 40 }]}>
      <ActivityIndicator size="large" color={CHAMBA.blue} />
      <Text style={styles.loadingText}>Sincronizando chambas…</Text>
    </View>
  ) : (
    <View style={chambaStyles.emptyCard}>
      <View style={[chambaStyles.iconCircleRight, { backgroundColor: '#007AFF' }]}>
        <Ionicons name="briefcase-outline" size={22} color="#FFF" />
      </View>
      <Text style={styles.emptyTitle}>
        Sin chambas {activeTab === 'open' ? 'en subasta' : activeTab === 'active' ? 'en curso' : 'finalizadas'}
      </Text>
      <Text style={styles.emptySub}>El radar no detecta actividad en esta categoría.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
            tintColor={CHAMBA.blue}
          />
        }
        renderItem={({ item }) => (
          <AdminJobCard
            job={item}
            tab={activeTab}
            onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
          />
        )}
        ListEmptyComponent={listEmpty}
      />
    </SafeAreaView>
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
  const visual = jobCategoryVisual(job.category);

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
      <View style={styles.jobCardMain}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
          <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>
          <Text style={styles.jobMeta}>
            {getCategoryLabel(job.category)} · {formatRelativeTime(job.created_at)}
          </Text>
          <Text style={styles.jobPay}>{formatCurrency(job.pay_amount)}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={CHAMBA.muted} />
            <Text style={styles.locationText} numberOfLines={1}>
              {job.location?.address ?? '—'}
            </Text>
          </View>
          <View style={styles.statusWrap}>
            <StatusBadge status={job.status} size="sm" />
          </View>
        </View>
        <View style={[chambaStyles.iconCircleRight, { backgroundColor: visual.color }]}>
          {visual.icon}
        </View>
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
                <Ionicons name="call" size={16} color={CHAMBA.blue} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.moneyCard}>
            <MoneyRow label="Total pagado por cliente" value={formatCurrency(job.pay_amount)} />
            <MoneyRow
              label="Comisión plataforma (5%)"
              value={formatCurrency(job.platform_fee)}
              valueColor={CHAMBA.blue}
              bold
            />
            <View style={styles.dividerThin} />
            <MoneyRow
              label="A transferir al trabajador (95%)"
              value={formatCurrency(job.worker_payout)}
              valueColor="#34C759"
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
}> = ({ label, value, valueColor = CHAMBA.navy, bold = false }) => (
  <View style={styles.moneyRow}>
    <Text style={styles.moneyLabel}>{label}</Text>
    <Text style={[styles.moneyValue, { color: valueColor, fontWeight: bold ? '600' : '400' }]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 14, color: CHAMBA.muted, fontWeight: '400' },
  listContent: { paddingHorizontal: 20, flexGrow: 1 },
  headerBlock: { gap: 16, paddingTop: 8, paddingBottom: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: CHAMBA.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_STEP_SHADOW,
  },
  bentoGrid: { gap: 12 },
  bentoRow: { flexDirection: 'row', gap: 12 },
  jobCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    ...CARD_STEP_SHADOW,
  },
  jobCardMain: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  jobTitle: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy, marginBottom: 2 },
  jobMeta: { fontSize: 12, color: CHAMBA.muted, fontWeight: '400', marginBottom: 6 },
  jobPay: { fontSize: 15, fontWeight: '600', color: CHAMBA.navy, marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  locationText: { fontSize: 12, color: CHAMBA.muted, flex: 1, fontWeight: '400' },
  statusWrap: { alignSelf: 'flex-start' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  dividerThin: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workerName: { fontSize: 14, fontWeight: '600', color: CHAMBA.navy },
  workerStatus: { fontSize: 11, color: CHAMBA.muted, marginTop: 1, fontWeight: '400' },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moneyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    gap: 6,
  },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moneyLabel: { fontSize: 12, color: CHAMBA.muted, flex: 1, fontWeight: '400' },
  moneyValue: { fontSize: 14 },
  completedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  completedWorker: { fontSize: 12, fontWeight: '600', color: CHAMBA.muted },
  completedFee: { fontSize: 12, fontWeight: '600', color: CHAMBA.blue },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy, textAlign: 'center' },
  emptySub: { fontSize: 13, color: CHAMBA.muted, textAlign: 'center', fontWeight: '400' },
});
