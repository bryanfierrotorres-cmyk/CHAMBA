import React, { useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '@components/Badge';
import { AdminMetricCard } from '@components/admin/AdminMetricCard';
import { useAuthStore } from '@store/authStore';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import { fetchAdminJobs, type AdminJob } from '../services/adminService';
import {
  computeDashboardKpis,
  getOpenJobsForModeration,
  getRadarJobs,
  getJobElapsedHours,
  isRadarAlert,
  RADAR_ALERT_HOURS,
} from '../utils/adminDashboardMetrics';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import { formatCurrency, formatRelativeTime, getCategoryLabel } from '@utils/formatters';
import type { JobStackParamList } from '@/types';

type Nav = NativeStackNavigationProp<JobStackParamList>;

const TopServicesCard: React.FC<{
  items: Array<{ category: string; count: number }>;
  getLabel: (slug: string) => string;
}> = ({ items, getLabel }) => (
  <View style={styles.topServicesCard}>
    <View style={styles.topServicesHeader}>
      <View style={styles.topServicesText}>
        <Text style={styles.topServicesTitle}>Top servicios</Text>
        <Text style={styles.topServicesSub}>Más solicitados este mes</Text>
      </View>
      <View style={[styles.topServicesIcon, { backgroundColor: '#5856D6' }]}>
        <Ionicons name="trophy" size={20} color="#FFF" />
      </View>
    </View>
    {items.length === 0 ? (
      <Text style={styles.topServicesEmpty}>Sin solicitudes este mes</Text>
    ) : (
      items.map((item, index) => (
        <View key={item.category} style={styles.topServiceRow}>
          <Text style={styles.topServiceRank}>{index + 1}.</Text>
          <Text style={styles.topServiceName} numberOfLines={1}>
            {getLabel(item.category) || getCategoryLabel(item.category)}
          </Text>
          <Text style={styles.topServiceCount}>{item.count}</Text>
        </View>
      ))
    )}
  </View>
);

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const { getLabel } = useCatalog();

  const { data, isLoading, isFetching, refetch, isRefetching } = useQuery<AdminJob[]>({
    queryKey: ['admin', 'control', 'jobs'],
    queryFn: fetchAdminJobs,
    staleTime: 45_000,
    refetchInterval: 60_000,
    placeholderData: [],
    retry: 0,
  });
  const jobs: AdminJob[] = data ?? [];
  const showInitialLoader = isLoading && isFetching && jobs.length === 0;

  const kpis = useMemo(() => computeDashboardKpis(jobs), [jobs]);
  const openJobs = useMemo(() => getOpenJobsForModeration(jobs), [jobs]);
  const radarJobs = useMemo(() => getRadarJobs(jobs), [jobs]);
  const alertCount = useMemo(
    () => radarJobs.filter(isRadarAlert).length,
    [radarJobs],
  );

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={chambaStyles.screenTitle}>Torre de Control</Text>
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
          label="Ingresos del mes"
          value={formatCurrency(kpis.monthlyRevenue)}
          accent="#007AFF"
          wide
        />
        <View style={styles.bentoRow}>
          <AdminMetricCard
            icon="task_alt"
            label="Completados"
            value={String(kpis.completedThisMonth)}
            accent="#34C759"
          />
          <AdminMetricCard
            icon="cancel"
            label="Cancelados"
            value={String(kpis.cancelledThisMonth)}
            accent="#EF4444"
          />
        </View>
        <TopServicesCard items={kpis.topServices} getLabel={getLabel} />
      </View>

      <View style={styles.moderationHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[chambaStyles.sectionTitle, { marginBottom: 4 }]}>
            Moderación
          </Text>
          <Text style={styles.radarSub}>
            {openJobs.length} solicitud{openJobs.length === 1 ? '' : 'es'} abierta{openJobs.length === 1 ? '' : 's'} — retira spam o errores antes de que un técnico postule
          </Text>
        </View>
      </View>

      {openJobs.length === 0 ? (
        <View style={styles.moderationEmpty}>
          <Text style={styles.moderationEmptyText}>No hay solicitudes abiertas pendientes de moderación</Text>
        </View>
      ) : (
        openJobs.slice(0, 8).map((job) => (
          <OpenJobModerationCard
            key={job.id}
            job={job}
            onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
          />
        ))
      )}

      <View style={styles.radarHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[chambaStyles.sectionTitle, { marginBottom: 4 }]}>
            Radar operativo
          </Text>
          <Text style={styles.radarSub}>
            {radarJobs.length} en curso
            {alertCount > 0 ? ` · ${alertCount} requieren intervención (+${RADAR_ALERT_HOURS}h)` : ''}
          </Text>
        </View>
        {alertCount > 0 ? (
          <View style={styles.alertPill}>
            <Ionicons name="warning" size={14} color="#B45309" />
            <Text style={styles.alertPillText}>{alertCount}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const listEmpty = showInitialLoader ? (
    <View style={[styles.center, { paddingVertical: 40 }]}>
      <ActivityIndicator size="large" color={CHAMBA.blue} />
      <Text style={styles.loadingText}>Sincronizando radar…</Text>
    </View>
  ) : (
    <View style={chambaStyles.emptyCard}>
      <View style={[chambaStyles.iconCircleRight, { backgroundColor: '#34C759' }]}>
        <Ionicons name="checkmark-circle" size={22} color="#FFF" />
      </View>
      <Text style={styles.emptyTitle}>Sin servicios en curso</Text>
      <Text style={styles.emptySub}>
        Cuando un técnico tome una chamba aparecerá aquí con alerta si supera {RADAR_ALERT_HOURS} horas.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={radarJobs}
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
          <RadarJobCard
            job={item}
            onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
          />
        )}
        ListEmptyComponent={listEmpty}
      />
    </SafeAreaView>
  );
};

const OpenJobModerationCard: React.FC<{ job: AdminJob; onPress: () => void }> = ({ job, onPress }) => {
  const creatorName = job.creator?.full_name?.trim() || 'Cliente';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={styles.openJobCard}
    >
      <View style={styles.openJobMain}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.radarTitle} numberOfLines={2}>{job.title}</Text>
          <Text style={styles.radarMeta}>
            {getCategoryLabel(job.category)} · {formatRelativeTime(job.created_at)}
          </Text>
          <Text style={styles.radarPay}>{formatCurrency(job.pay_amount)}</Text>
          <Text style={styles.radarWorker} numberOfLines={1}>
            Cliente: {creatorName}
          </Text>
        </View>
        <View style={styles.radarRight}>
          <StatusBadge status={job.status} size="sm" />
          <View style={styles.openJobPill}>
            <Ionicons name="shield-outline" size={12} color={CHAMBA.blue} />
            <Text style={styles.openJobPillText}>Revisar</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const RadarJobCard: React.FC<{ job: AdminJob; onPress: () => void }> = ({ job, onPress }) => {
  const hours = getJobElapsedHours(job);
  const alert = isRadarAlert(job);
  const worker = job.assignments?.[0]?.worker;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[styles.radarCard, alert && styles.radarCardAlert]}
    >
      {alert ? (
        <View style={styles.radarAlertBanner}>
          <Ionicons name="warning" size={14} color="#B45309" />
          <Text style={styles.radarAlertText}>
            {Math.floor(hours)}h en curso — requiere intervención
          </Text>
        </View>
      ) : null}

      <View style={styles.radarCardMain}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.radarTitle} numberOfLines={2}>{job.title}</Text>
          <Text style={styles.radarMeta}>
            {getCategoryLabel(job.category)} · {formatRelativeTime(job.updated_at ?? job.created_at)}
          </Text>
          <Text style={styles.radarPay}>{formatCurrency(job.pay_amount)}</Text>
          {worker ? (
            <Text style={styles.radarWorker} numberOfLines={1}>
              Técnico: {worker.full_name ?? '—'}
            </Text>
          ) : null}
        </View>
        <View style={styles.radarRight}>
          <StatusBadge status={job.status} size="sm" />
          <Text style={[styles.radarHours, alert && styles.radarHoursAlert]}>
            {hours < 1 ? '<1h' : `${Math.floor(hours)}h`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
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
  topServicesCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    ...CARD_STEP_SHADOW,
  },
  topServicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topServicesText: { flex: 1, paddingRight: 10 },
  topServicesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: CHAMBA.navy,
    letterSpacing: -0.3,
  },
  topServicesSub: { fontSize: 12, color: CHAMBA.muted, marginTop: 2 },
  topServicesIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topServicesEmpty: { fontSize: 13, color: CHAMBA.muted },
  topServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
  },
  topServiceRank: {
    width: 22,
    fontSize: 13,
    fontWeight: '700',
    color: CHAMBA.blue,
  },
  topServiceName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: CHAMBA.navy,
  },
  topServiceCount: {
    fontSize: 13,
    fontWeight: '700',
    color: CHAMBA.muted,
  },
  moderationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  moderationEmpty: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
    ...CARD_STEP_SHADOW,
  },
  moderationEmptyText: {
    fontSize: 13,
    color: CHAMBA.muted,
    textAlign: 'center',
  },
  openJobCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    ...CARD_STEP_SHADOW,
  },
  openJobMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  openJobPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  openJobPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: CHAMBA.blue,
  },
  radarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  radarSub: { fontSize: 13, color: CHAMBA.muted, fontWeight: '400' },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  alertPillText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  radarCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    ...CARD_STEP_SHADOW,
  },
  radarCardAlert: {
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  radarAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FDE68A',
  },
  radarAlertText: { fontSize: 12, fontWeight: '600', color: '#B45309', flex: 1 },
  radarCardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  radarTitle: { fontSize: 15, fontWeight: '600', color: CHAMBA.navy, marginBottom: 2 },
  radarMeta: { fontSize: 12, color: CHAMBA.muted, marginBottom: 4 },
  radarPay: { fontSize: 14, fontWeight: '600', color: CHAMBA.navy, marginBottom: 4 },
  radarWorker: { fontSize: 12, color: CHAMBA.muted },
  radarRight: { alignItems: 'flex-end', gap: 8 },
  radarHours: {
    fontSize: 12,
    fontWeight: '700',
    color: CHAMBA.muted,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  radarHoursAlert: { color: '#B45309', backgroundColor: '#FEF3C7' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy, textAlign: 'center' },
  emptySub: { fontSize: 13, color: CHAMBA.muted, textAlign: 'center', fontWeight: '400' },
});
