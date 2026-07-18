import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '@components/Badge';
import { AdminMetricCard } from '@components/admin/AdminMetricCard';
import { useAuthStore } from '@store/authStore';
import { resolveAdminActorProfile } from '@utils/profileSync';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import { fetchAdminJobs, fetchAllClients, fetchAllWorkers, type AdminJob } from '../../services/adminService';
import {
  fetchAvailableWorkersCount,
  fetchAvailableWorkerIds,
  fetchAverageWorkerRating,
} from '../services/executiveMetricsService';
import { diagnoseSystem, type SystemStatus } from '@utils/systemHealth';
import { computeOperationalInsights, type InsightKind } from '../utils/operationalInsights';
import { JobListModal } from '../components/JobListModal';
import { PeopleListModal, type PersonRow } from '../components/PeopleListModal';
import {
  computeDashboardKpis,
  computeExecutiveMetrics,
  computeTodayRevenue,
  computeOperationalAlerts,
  computeFunnelMetrics,
  computeRetentionMetrics,
  computePeakHours,
  formatHourLabel,
  formatDurationMinutes,
  formatDurationPrecise,
  getCompletedJobsThisMonth,
  getCancelledJobsThisMonth,
  getPendingJobs,
  getOpenJobsForModeration,
  getRadarJobs,
  getJobElapsedHours,
  isRadarAlert,
  RADAR_ALERT_HOURS,
} from '../utils/adminDashboardMetrics';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import { formatCurrency, formatRelativeTime, getCategoryLabel } from '@utils/formatters';
import type { JobStackParamList, UserProfile } from '@/types';

const INSIGHT_ICON: Record<InsightKind, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  warning: { name: 'warning', color: '#B45309' },
  opportunity: { name: 'trending-up', color: '#15803D' },
  info: { name: 'information-circle', color: '#0EA5E9' },
};

type JobModalState = {
  type: 'jobs';
  title: string;
  subtitle: string;
  jobs: AdminJob[];
  emptyMessage: string;
  getExtraLabel?: (job: AdminJob) => string | null;
};
type PeopleModalState = {
  type: 'people';
  title: string;
  subtitle: string;
  people: PersonRow[];
  emptyMessage: string;
};
type DetailModalState = JobModalState | PeopleModalState | null;

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
  const queryClient = useQueryClient();
  const { getLabel } = useCatalog();

  useEffect(() => {
    if (!profile?.id || profile.role !== 'admin') return;
    let cancelled = false;
    void (async () => {
      await resolveAdminActorProfile(profile).catch(() => undefined);
      if (cancelled) return;
      void queryClient.invalidateQueries({ queryKey: ['admin', 'control', 'jobs'] });
      void queryClient.refetchQueries({ queryKey: ['admin', 'control', 'jobs'] });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.role, queryClient]);

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

  const { data: availableWorkers } = useQuery<number>({
    queryKey: ['admin', 'control', 'available-workers'],
    queryFn: fetchAvailableWorkersCount,
    staleTime: 45_000,
    refetchInterval: 60_000,
    placeholderData: 0,
    retry: 0,
  });

  const { data: ratingData } = useQuery({
    queryKey: ['admin', 'control', 'avg-rating'],
    queryFn: fetchAverageWorkerRating,
    staleTime: 60_000,
    retry: 0,
  });

  // Mismo query key que ManageWorkersScreen — React Query lo cachea una sola vez.
  const { data: clientsData } = useQuery({
    queryKey: ['admin', 'clients'],
    queryFn: fetchAllClients,
    staleTime: 15_000,
    retry: 1,
  });
  const activeClientsCount = (clientsData ?? []).filter((c: UserProfile) => c.is_approved).length;

  const { data: systemDiag } = useQuery({
    queryKey: ['admin', 'control', 'system-status'],
    queryFn: () => diagnoseSystem(),
    staleTime: 60_000,
    retry: 0,
  });

  // Mismo query key que ManageWorkersScreen — React Query lo cachea una sola vez.
  const { data: allWorkersData } = useQuery({
    queryKey: ['admin', 'workers'],
    queryFn: fetchAllWorkers,
    staleTime: 15_000,
    retry: 1,
  });

  const { data: availableWorkerIds } = useQuery({
    queryKey: ['admin', 'control', 'available-worker-ids'],
    queryFn: fetchAvailableWorkerIds,
    staleTime: 45_000,
    retry: 0,
  });

  const [detailModal, setDetailModal] = useState<DetailModalState>(null);

  const kpis = useMemo(() => computeDashboardKpis(jobs), [jobs]);
  const execMetrics = useMemo(() => computeExecutiveMetrics(jobs), [jobs]);
  const todayRevenue = useMemo(() => computeTodayRevenue(jobs), [jobs]);
  const funnel = useMemo(() => computeFunnelMetrics(jobs), [jobs]);
  const retention = useMemo(() => computeRetentionMetrics(jobs), [jobs]);
  const peakHours = useMemo(() => computePeakHours(jobs), [jobs]);
  const openJobs = useMemo(() => getOpenJobsForModeration(jobs), [jobs]);
  const radarJobs = useMemo(() => getRadarJobs(jobs), [jobs]);
  const alertCount = useMemo(
    () => radarJobs.filter(isRadarAlert).length,
    [radarJobs],
  );
  const alerts = useMemo(
    () => computeOperationalAlerts(jobs, execMetrics, kpis, availableWorkers ?? 0),
    [jobs, execMetrics, kpis, availableWorkers],
  );
  const insights = useMemo(
    () => computeOperationalInsights(
      jobs,
      availableWorkers ?? 0,
      (slug) => getLabel(slug) || getCategoryLabel(slug),
    ),
    [jobs, availableWorkers, getLabel],
  );

  // ── Listas detrás de cada número — el drill-down que pidió el admin ──────
  const completedJobsList = useMemo(() => getCompletedJobsThisMonth(jobs), [jobs]);
  const cancelledJobsList = useMemo(() => getCancelledJobsThisMonth(jobs), [jobs]);
  const pendingJobsList = useMemo(() => getPendingJobs(jobs), [jobs]);
  const criticalJobsList = useMemo(() => radarJobs.filter(isRadarAlert), [radarJobs]);

  const acceptanceSortedJobs = useMemo(() => {
    return jobs
      .filter((j) => j.assignments?.[0]?.assigned_at)
      .map((j) => {
        const assignment = j.assignments[0];
        const minutes = (new Date(assignment.assigned_at).getTime() - new Date(j.created_at).getTime()) / 60_000;
        return { job: j, minutes };
      })
      .filter((x) => Number.isFinite(x.minutes) && x.minutes >= 0)
      .sort((a, b) => b.minutes - a.minutes); // más lentos primero — lo accionable
  }, [jobs]);

  const completionSortedJobs = useMemo(() => {
    return jobs
      .filter((j) => j.assignments?.[0]?.assigned_at && j.assignments?.[0]?.completed_at)
      .map((j) => {
        const assignment = j.assignments[0];
        const minutes = (new Date(assignment.completed_at!).getTime() - new Date(assignment.assigned_at).getTime()) / 60_000;
        return { job: j, minutes };
      })
      .filter((x) => Number.isFinite(x.minutes) && x.minutes >= 0)
      .sort((a, b) => b.minutes - a.minutes);
  }, [jobs]);

  const activeClientsPeople = useMemo<PersonRow[]>(
    () => (clientsData ?? [])
      .filter((c: UserProfile) => c.is_approved)
      .map((c: UserProfile) => ({
        id: c.id, full_name: c.full_name, phone: c.phone, avatar_url: c.avatar_url,
      })),
    [clientsData],
  );

  const availableWorkersPeople = useMemo<PersonRow[]>(() => {
    const ids = availableWorkerIds ?? new Set<string>();
    return (allWorkersData ?? [])
      .filter((w: UserProfile) => ids.has(w.id))
      .map((w: UserProfile) => ({
        id: w.id, full_name: w.full_name, phone: w.phone, avatar_url: w.avatar_url,
        meta: w.category_1 ? getLabel(w.category_1) || undefined : undefined,
        badge: 'Disponible',
      }));
  }, [allWorkersData, availableWorkerIds, getLabel]);

  const platformStatus: SystemStatus = systemDiag?.status ?? 'OK';
  const PLATFORM_STATUS_UI: Record<SystemStatus, { dot: string; label: string; bg: string }> = {
    OK:       { dot: '#22C55E', label: 'Operativa', bg: '#F0FDF4' },
    DEGRADED: { dot: '#F59E0B', label: 'Degradada', bg: '#FFFBEB' },
    DOWN:     { dot: '#EF4444', label: 'Caída',      bg: '#FEF2F2' },
  };

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

      <View style={[styles.platformPill, { backgroundColor: PLATFORM_STATUS_UI[platformStatus].bg }]}>
        <View style={[styles.platformDot, { backgroundColor: PLATFORM_STATUS_UI[platformStatus].dot }]} />
        <Text style={styles.platformLabel}>Plataforma {PLATFORM_STATUS_UI[platformStatus].label}</Text>
      </View>

      {alerts.length > 0 && (
        <View style={styles.alertsCard}>
          <View style={styles.alertsHeader}>
            <Ionicons name="notifications" size={18} color="#B45309" />
            <Text style={styles.alertsTitle}>Alertas</Text>
          </View>
          {alerts.map((a) => (
            <View key={a.id} style={styles.alertRow}>
              <View style={[styles.alertDot, a.severity === 'high' && styles.alertDotHigh]} />
              <Text style={styles.alertText}>{a.message}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.bentoGrid}>
        <View style={styles.bentoRow}>
          <AdminMetricCard
            icon="attach_money"
            label="Comisión hoy"
            value={formatCurrency(todayRevenue)}
            accent="#007AFF"
          />
          <AdminMetricCard
            icon="star"
            label="Satisfacción"
            value={ratingData?.average != null ? `${ratingData.average.toFixed(2)}★` : '—'}
            accent="#F59E0B"
          />
        </View>
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
            onPress={() => setDetailModal({
              type: 'jobs',
              title: 'Completados este mes',
              subtitle: `${completedJobsList.length} solicitud(es)`,
              jobs: completedJobsList,
              emptyMessage: 'Sin trabajos completados este mes.',
            })}
          />
          <AdminMetricCard
            icon="cancel"
            label="Cancelados"
            value={String(kpis.cancelledThisMonth)}
            accent="#EF4444"
            onPress={() => setDetailModal({
              type: 'jobs',
              title: 'Cancelados este mes',
              subtitle: `${cancelledJobsList.length} solicitud(es)`,
              jobs: cancelledJobsList,
              emptyMessage: 'Sin cancelaciones este mes.',
            })}
          />
        </View>

        <View style={styles.bentoRow}>
          <AdminMetricCard
            icon="groups"
            label="Clientes activos"
            value={String(activeClientsCount)}
            accent="#0EA5E9"
            onPress={() => setDetailModal({
              type: 'people',
              title: 'Clientes activos',
              subtitle: `${activeClientsPeople.length} cliente(s) aprobado(s)`,
              people: activeClientsPeople,
              emptyMessage: 'Sin clientes aprobados todavía.',
            })}
          />
          <AdminMetricCard
            icon="engineering"
            label="Técnicos disponibles"
            value={String(availableWorkers ?? 0)}
            accent="#34C759"
            onPress={() => setDetailModal({
              type: 'people',
              title: 'Técnicos disponibles',
              subtitle: `${availableWorkersPeople.length} técnico(s) ahora mismo`,
              people: availableWorkersPeople,
              emptyMessage: 'Ningún técnico marcado como disponible ahora mismo.',
            })}
          />
        </View>
        <View style={styles.bentoRow}>
          <AdminMetricCard
            icon="bolt"
            label="Trabajos activos"
            value={String(execMetrics.activeJobsCount)}
            accent="#0EA5E9"
            onPress={() => setDetailModal({
              type: 'jobs',
              title: 'Trabajos activos',
              subtitle: `${radarJobs.length} en curso`,
              jobs: radarJobs,
              emptyMessage: 'Sin trabajos en curso ahora mismo.',
            })}
          />
          <AdminMetricCard
            icon="hourglass_empty"
            label="Pendientes"
            value={String(execMetrics.pendingJobsCount)}
            accent="#F59E0B"
            onPress={() => setDetailModal({
              type: 'jobs',
              title: 'Trabajos pendientes',
              subtitle: `${pendingJobsList.length} sin técnico asignado`,
              jobs: pendingJobsList,
              emptyMessage: 'Sin solicitudes pendientes.',
            })}
          />
        </View>
        <View style={styles.bentoRow}>
          <AdminMetricCard
            icon="priority_high"
            label="Críticos (+8h)"
            value={String(execMetrics.criticalJobsCount)}
            accent="#EF4444"
            onPress={() => setDetailModal({
              type: 'jobs',
              title: `Críticos (+${RADAR_ALERT_HOURS}h)`,
              subtitle: `${criticalJobsList.length} requieren intervención`,
              jobs: criticalJobsList,
              emptyMessage: 'Ningún trabajo crítico ahora mismo.',
              getExtraLabel: (job) => `${Math.floor(getJobElapsedHours(job))}h en curso — revisar`,
            })}
          />
          <AdminMetricCard
            icon="person_search"
            label="Clientes esperando"
            value={String(execMetrics.waitingClientsCount)}
            accent="#8B5CF6"
            onPress={() => setDetailModal({
              type: 'jobs',
              title: 'Clientes esperando técnico',
              subtitle: `${execMetrics.waitingClientsCount} cliente(s) distinto(s)`,
              jobs: pendingJobsList,
              emptyMessage: 'Ningún cliente esperando ahora mismo.',
            })}
          />
        </View>
        <View style={styles.bentoRow}>
          <AdminMetricCard
            icon="timer"
            label="Prom. aceptación"
            value={formatDurationPrecise(execMetrics.avgAcceptanceMinutes)}
            accent="#007AFF"
            onPress={() => setDetailModal({
              type: 'jobs',
              title: 'Tiempo de aceptación por trabajo',
              subtitle: 'Los más lentos primero',
              jobs: acceptanceSortedJobs.map((x) => x.job),
              emptyMessage: 'Sin datos de aceptación todavía.',
              getExtraLabel: (job) => {
                const found = acceptanceSortedJobs.find((x) => x.job.id === job.id);
                return found ? `Aceptado en ${formatDurationPrecise(found.minutes)}` : null;
              },
            })}
          />
          <AdminMetricCard
            icon="task_alt"
            label="Prom. finalización"
            value={formatDurationMinutes(execMetrics.avgCompletionMinutes)}
            accent="#5856D6"
            onPress={() => setDetailModal({
              type: 'jobs',
              title: 'Tiempo de finalización por trabajo',
              subtitle: 'Los más lentos primero',
              jobs: completionSortedJobs.map((x) => x.job),
              emptyMessage: 'Sin datos de finalización todavía.',
              getExtraLabel: (job) => {
                const found = completionSortedJobs.find((x) => x.job.id === job.id);
                return found ? `Finalizado en ${formatDurationMinutes(found.minutes)}` : null;
              },
            })}
          />
        </View>

        <TopServicesCard items={kpis.topServices} getLabel={getLabel} />

        <View style={styles.analyticsCard}>
          <View style={styles.topServicesHeader}>
            <View style={styles.topServicesText}>
              <Text style={styles.topServicesTitle}>Analíticas</Text>
              <Text style={styles.topServicesSub}>Sobre todo el historial, no solo este mes</Text>
            </View>
            <View style={[styles.topServicesIcon, { backgroundColor: '#0EA5E9' }]}>
              <Ionicons name="analytics" size={20} color="#FFF" />
            </View>
          </View>

          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>Embudo</Text>
            <Text style={styles.analyticsValue}>
              {funnel.openCount} abiertos → {funnel.activeCount} en curso → {funnel.completedCount} completados
              {funnel.cancelledCount > 0 ? ` (${funnel.cancelledCount} cancelados)` : ''}
            </Text>
          </View>
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>Conversión</Text>
            <Text style={styles.analyticsValue}>
              {funnel.conversionRate != null ? `${funnel.conversionRate.toFixed(0)}%` : '—'} de lo asignado termina completado
            </Text>
          </View>
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>Retención</Text>
            <Text style={styles.analyticsValue}>
              {retention.retentionRate != null ? `${retention.retentionRate.toFixed(0)}%` : '—'} de clientes repite ({retention.repeatClients}/{retention.totalClients})
            </Text>
          </View>
          <View style={styles.analyticsRow}>
            <Text style={styles.analyticsLabel}>Horas pico</Text>
            <Text style={styles.analyticsValue}>
              {peakHours.length > 0
                ? peakHours.map((h) => `${formatHourLabel(h.hour)} (${h.count})`).join(' · ')
                : 'Sin datos suficientes'}
            </Text>
          </View>
        </View>

        <View style={styles.analyticsCard}>
          <View style={styles.topServicesHeader}>
            <View style={styles.topServicesText}>
              <Text style={styles.topServicesTitle}>Inteligencia Operacional</Text>
              <Text style={styles.topServicesSub}>Recomendaciones automáticas para dirigir el negocio</Text>
            </View>
            <View style={[styles.topServicesIcon, { backgroundColor: '#7C3AED' }]}>
              <Ionicons name="bulb" size={20} color="#FFF" />
            </View>
          </View>

          {insights.length === 0 ? (
            <Text style={styles.insightEmpty}>
              Aún no hay suficiente actividad para generar recomendaciones. Se activan solas
              a medida que crecen las solicitudes — sin configuración.
            </Text>
          ) : (
            insights.map((insight) => (
              <View key={insight.id} style={styles.insightRow}>
                <Ionicons
                  name={INSIGHT_ICON[insight.kind].name}
                  size={18}
                  color={INSIGHT_ICON[insight.kind].color}
                  style={{ marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightDetail}>{insight.detail}</Text>
                </View>
              </View>
            ))
          )}
        </View>
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

      <JobListModal
        visible={detailModal?.type === 'jobs'}
        onClose={() => setDetailModal(null)}
        title={detailModal?.type === 'jobs' ? detailModal.title : ''}
        subtitle={detailModal?.type === 'jobs' ? detailModal.subtitle : ''}
        jobs={detailModal?.type === 'jobs' ? detailModal.jobs : []}
        emptyMessage={detailModal?.type === 'jobs' ? detailModal.emptyMessage : ''}
        getExtraLabel={detailModal?.type === 'jobs' ? detailModal.getExtraLabel : undefined}
        onSelectJob={(jobId) => navigation.navigate('JobDetail', { jobId })}
      />
      <PeopleListModal
        visible={detailModal?.type === 'people'}
        onClose={() => setDetailModal(null)}
        title={detailModal?.type === 'people' ? detailModal.title : ''}
        subtitle={detailModal?.type === 'people' ? detailModal.subtitle : ''}
        people={detailModal?.type === 'people' ? detailModal.people : []}
        emptyMessage={detailModal?.type === 'people' ? detailModal.emptyMessage : ''}
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
  platformPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  platformDot: { width: 8, height: 8, borderRadius: 4 },
  platformLabel: { fontSize: 12, fontWeight: '700', color: CHAMBA.navy },
  alertsCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertsTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  alertDot: {
    width: 6, height: 6, borderRadius: 3, marginTop: 6,
    backgroundColor: '#F59E0B', flexShrink: 0,
  },
  alertDotHigh: { backgroundColor: '#DC2626' },
  alertText: { flex: 1, fontSize: 13, color: '#78350F', lineHeight: 18 },
  analyticsCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    gap: 10,
    ...CARD_STEP_SHADOW,
  },
  analyticsRow: {
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
    gap: 2,
  },
  analyticsLabel: { fontSize: 12, fontWeight: '700', color: CHAMBA.blue },
  analyticsValue: { fontSize: 13, color: CHAMBA.navy, lineHeight: 18 },
  insightRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  insightTitle: { fontSize: 13, fontWeight: '600', color: CHAMBA.navy, lineHeight: 18 },
  insightDetail: { fontSize: 12, color: CHAMBA.muted, marginTop: 2, lineHeight: 16 },
  insightEmpty: { fontSize: 13, color: CHAMBA.muted, lineHeight: 19, paddingTop: 4 },
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
