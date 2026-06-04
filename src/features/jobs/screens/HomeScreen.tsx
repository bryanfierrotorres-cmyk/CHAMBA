import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator,
  TouchableOpacity, Animated, StyleSheet, Platform, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { JobCard } from '../components/JobCard';
import { EmptyState } from '@components/EmptyState';
import { WorkerTopBar } from '@components/worker/WorkerTopBar';
import { RadarServiceFilters } from '@components/worker/RadarServiceFilters';
import { useJobFeed, JOB_KEYS, useAcceptJob } from '../hooks/useJobs';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { useJobStore } from '@store/jobStore';
import { WORKER_COLORS as COLORS, M3, BORDER_RADIUS, FONT_SIZE, SPACING } from '@constants/workerTheme';
import { stitchTypography, stitchLayout, CARD_ELEVATION } from '@constants/stitchStyles';
import { textInputWebFocusStyle } from '@constants/textInputFocus';
import { getCategoryLabel, formatCurrency } from '@utils/formatters';
import { sortServiceTypesByConfig } from '@constants/servicesConfig';
import { fromDbJobCategory } from '@constants/chambaCategories';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import type { ServiceType } from '@features/catalog/types';
import { getWorkerApprovedCategories } from '@utils/workerCategoryAccess';
import { useAssignmentsStore } from '@store/assignmentsStore';
import type { Job, JobCategory, JobStackParamList, WorkerTabParamList } from '@/types';

type StackNav = NativeStackNavigationProp<JobStackParamList, 'JobList'>;

type CategoryItem = { value: string; label: string };

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';
interface ToastData { type: ToastType; message: string; }

const useToast = () => {
  const [visible, setVisible] = useState(false);
  const [data, setData]       = useState<ToastData>({ type: 'success', message: '' });
  const translateY             = useRef(new Animated.Value(-120)).current;
  const timerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  const show = useCallback((toast: ToastData, duration = 3200) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setData(toast);
    setVisible(true);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    timerRef.current = setTimeout(() => {
      Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true })
        .start(() => setVisible(false));
    }, duration);
  }, [translateY]);

  return { visible, data, translateY, show };
};

// ─── Online status pill ───────────────────────────────────────────────────────

const OnlinePill: React.FC<{ online: boolean }> = ({ online }) => (
  <View style={[stitchLayout.statusPillOnline, !online && styles.offlinePill]}>
    <View style={[styles.onlineDot, !online && styles.offlineDot]} />
    <Text style={[stitchLayout.statusPillText, !online && styles.offlineText]}>
      {online ? 'En Línea' : 'Offline'}
    </Text>
  </View>
);

// ─── Feed Item ────────────────────────────────────────────────────────────────

interface FeedItemProps {
  job: Job; isApproved: boolean;
  acceptingJobId: string | null;
  acceptedJobIds: Set<string>;
  processJobIds: Set<string>;
  onPressDetail: () => void;
  onAccept: (job: Job) => Promise<void>;
  onInProcess: (job: Job) => void;
}
const FeedItem: React.FC<FeedItemProps> = ({
  job, isApproved, acceptingJobId, acceptedJobIds, processJobIds,
  onPressDetail, onAccept, onInProcess,
}) => (
  <JobCard
    job={job}
    onPress={onPressDetail}
    showSwipe={isApproved}
    onAccept={() => onAccept(job)}
    onInProcess={() => onInProcess(job)}
    isAccepting={acceptingJobId === job.id}
    isAccepted={acceptedJobIds.has(job.id) && !processJobIds.has(job.id)}
    isInProcess={processJobIds.has(job.id)}
  />
);

// ─── Search bar ───────────────────────────────────────────────────────────────

const SearchBar: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <View style={styles.searchWrap}>
    <Ionicons name="search-outline" size={20} color={COLORS.text.muted} />
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="¿Qué servicio buscas hoy?"
      placeholderTextColor={COLORS.text.muted}
      style={[styles.searchInput, textInputWebFocusStyle]}
      returnKeyType="search"
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChange('')}>
        <Ionicons name="close-circle" size={18} color={COLORS.text.muted} />
      </TouchableOpacity>
    )}
  </View>
);

// ─── Featured Banner — removed (Stitch radar feed) ─────────────────────────────

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const HomeScreen: React.FC = () => {
  const navigation    = useNavigation<StackNav>();
  const insets        = useSafeAreaInsets();
  const profile       = useAuthStore((s) => s.profile);
  const workerProfile = useProfileStore((s) => s.workerProfile);
  const { jobs: storeJobs } = useJobStore();
  const queryClient   = useQueryClient();
  const toast         = useToast();
  const { mutateAsync: acceptMut } = useAcceptJob();

  const [selectedCategory, setSelectedCategory] = useState<JobCategory | null>(null);
  const [acceptingJobId, setAcceptingJobId]      = useState<string | null>(null);
  const [acceptedJobIds, setAcceptedJobIds]      = useState<Set<string>>(new Set());
  const [processJobIds, setProcessJobIds]        = useState<Set<string>>(new Set());
  const [removedFromFeedIds, setRemovedFromFeedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery]            = useState('');
  const acceptingRef = useRef<Set<string>>(new Set());

  const catalog = useCatalog();

  const approvedCategories = useMemo(
    () => getWorkerApprovedCategories(profile),
    [profile],
  );

  const filterChips = useMemo<CategoryItem[]>(() => {
    const approved = new Set(approvedCategories);
    return sortServiceTypesByConfig(
      catalog.serviceTypes.filter((t: ServiceType) => approved.has(t.slug)) as ServiceType[],
    ).map((t) => ({
      value: t.slug,
      label: t.name.trim(),
    }));
  }, [catalog.serviceTypes, approvedCategories]);

  const effectiveCategories = useMemo<JobCategory[]>(() => {
    if (!profile?.is_approved) return [];
    if (selectedCategory) {
      return approvedCategories.includes(selectedCategory) ? [selectedCategory] : [];
    }
    return approvedCategories;
  }, [selectedCategory, approvedCategories, profile?.is_approved]);

  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJobFeed('open', undefined, effectiveCategories);

  // ── Realtime bridge (deduplicado por id) ─────────────────────────────────
  const queryJobs = useMemo(() => {
    const seen = new Map<string, Job>();
    for (const j of data?.pages.flatMap((p) => p.data) ?? []) {
      if (!seen.has(j.id)) seen.set(j.id, j);
    }
    return Array.from(seen.values());
  }, [data]);

  const storeMap  = useMemo(() => new Map(storeJobs.map((j) => [j.id, j])), [storeJobs]);

  const feedJobs = useMemo(() => {
    const allowed = new Set(effectiveCategories);
    const byId = new Map<string, Job>();

    for (const j of queryJobs) {
      byId.set(j.id, storeMap.get(j.id) ?? j);
    }

    for (const raw of storeJobs) {
      if (byId.has(raw.id)) continue;
      const cat = fromDbJobCategory(raw.category as string) ?? raw.category;
      if (!allowed.has(cat as JobCategory)) continue;
      if (raw.status !== 'open' && !processJobIds.has(raw.id)) continue;
      if (removedFromFeedIds.has(raw.id)) continue;
      byId.set(raw.id, storeMap.get(raw.id) ?? raw);
    }

    let all = Array.from(byId.values()).filter(
      (j) => j.status === 'open' || acceptedJobIds.has(j.id) || processJobIds.has(j.id),
    ).filter((j) => !removedFromFeedIds.has(j.id));

    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (j) => j.title?.toLowerCase().includes(q) || j.description?.toLowerCase().includes(q),
    );
  }, [queryJobs, storeMap, storeJobs, acceptedJobIds, processJobIds, removedFromFeedIds, effectiveCategories, searchQuery]);

  const handleAccept = useCallback(async (job: Job) => {
    if (!profile?.id || !profile.is_approved) return;
    if (
      acceptingRef.current.has(job.id) ||
      acceptingJobId === job.id ||
      acceptedJobIds.has(job.id) ||
      processJobIds.has(job.id)
    ) {
      return;
    }

    acceptingRef.current.add(job.id);
    setAcceptingJobId(job.id);
    try {
      await acceptMut({ jobId: job.id, job });
      setAcceptedJobIds((prev) => new Set([...prev, job.id]));
      toast.show({ type: 'success', message: '✅ ¡Chamba aceptada!' }, 2200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const isStorage = msg.includes('quota') || msg.includes('Quota') || msg.includes('Storage');
      const isConcurrency = msg.includes('lock') || msg.includes('taken') || msg.includes('tomado') || msg.includes('NOWAIT');
      if (!isStorage) {
        toast.show({
          type: 'error',
          message: isConcurrency ? '⚡ Este trabajo ya fue tomado' : msg || 'No se pudo tomar el trabajo',
        }, 3500);
      }
    } finally {
      acceptingRef.current.delete(job.id);
      setAcceptingJobId(null);
    }
  }, [profile, acceptMut, toast, acceptingJobId, acceptedJobIds, processJobIds]);

  const handleInProcess = useCallback((job: Job) => {
    setProcessJobIds((prev) => new Set([...prev, job.id]));
    toast.show({ type: 'success', message: '📋 Chamba en proceso — revisa Agenda' }, 2800);
    const workerId = useAuthStore.getState().profile?.id ?? profile?.id;
    setTimeout(() => {
      if (workerId) {
        void useAssignmentsStore.getState().refresh(workerId);
        queryClient.invalidateQueries({ queryKey: JOB_KEYS.myJobs(workerId) });
      }
      navigation
        .getParent<BottomTabNavigationProp<WorkerTabParamList>>()
        ?.navigate('MyJobs');
    }, 600);
    setTimeout(() => {
      setRemovedFromFeedIds((prev) => new Set([...prev, job.id]));
    }, 2500);
  }, [navigation, toast, profile?.id, queryClient]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isApproved   = !!profile?.is_approved;
  const availability = workerProfile?.availability_status ?? 'offline';
  const isOnline     = availability === 'available';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      <WorkerTopBar
        avatarUri={profile?.avatar_url}
        avatarName={profile?.full_name ?? 'CHAMBA'}
      />

      {/* ── Toast (absolute) ──────────────────────────────────────── */}
      {toast.visible && (
        <Animated.View
          style={[styles.toast, { transform: [{ translateY: toast.translateY }] }]}
          pointerEvents="none"
        >
          <View style={[styles.toastInner, toast.data.type === 'error' && styles.toastError]}>
            <Ionicons
              name={toast.data.type === 'success' ? 'checkmark-circle' : 'warning-outline'}
              size={22}
              color={toast.data.type === 'success' ? COLORS.brand[400] : COLORS.error}
            />
            <Text style={[styles.toastText, toast.data.type === 'error' && styles.toastTextError]}>
              {toast.data.message}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── Feed FlatList ─────────────────────────────────────────── */}
      <FlatList
        data={feedJobs}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={COLORS.brand[500]} />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <FeedItem
            job={item}
            isApproved={isApproved}
            acceptingJobId={acceptingJobId}
            acceptedJobIds={acceptedJobIds}
            processJobIds={processJobIds}
            onPressDetail={() => navigation.navigate('JobDetail', { jobId: item.id })}
            onAccept={handleAccept}
            onInProcess={handleInProcess}
          />
        )}
        ListHeaderComponent={
          <>
            {/* Radar Activo header */}
            <View style={styles.radarHeader}>
              <View>
                <Text style={stitchTypography.headlineLg}>Radar Activo</Text>
                <View style={styles.radarSubRow}>
                  <Ionicons name="navigate-circle-outline" size={16} color={M3.secondary} />
                  <Text style={stitchTypography.bodySm}>Buscando en tu zona...</Text>
                </View>
              </View>
              <OnlinePill online={isOnline} />
            </View>

            <SearchBar value={searchQuery} onChange={setSearchQuery} />

            {!isApproved && (
              <View style={styles.pendingBanner}>
                <Ionicons name="time-outline" size={14} color={M3.tertiary} />
                <Text style={styles.pendingText}>
                  Cuenta pendiente de aprobación — solo puedes ver las chambas
                </Text>
              </View>
            )}

            {filterChips.length > 0 && (
              <RadarServiceFilters
                items={filterChips.map((c) => ({ slug: c.value, label: c.label }))}
                selectedSlug={selectedCategory}
                onSelect={(slug) => setSelectedCategory(slug as JobCategory | null)}
              />
            )}

            {isLoading && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={M3.primary} />
              </View>
            )}
          </>
        }
        ListFooterComponent={
          isFetchingNextPage
            ? <ActivityIndicator color={COLORS.brand[500]} style={{ marginVertical: SPACING.md }} />
            : null
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="briefcase-outline"
              title="No hay chambas"
              subtitle={
                selectedCategory
                  ? `No hay chambas de ${catalog.getLabel(selectedCategory)} disponibles ahora.`
                  : 'No hay trabajos disponibles en este momento. ¡Vuelve pronto!'
              }
              actionLabel="Actualizar"
              onAction={refetch}
            />
          )
        }
      />
    </View>
  );
};

// ─── Styles — Material 3 (Stitch worker) ─────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: M3.background },

  radarHeader: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'space-between',
    marginTop:      SPACING.sm,
    marginBottom:   SPACING.md,
  },
  radarSubRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     4,
  },
  onlineDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: M3.secondary,
  },
  offlinePill: { backgroundColor: M3.surfaceContainerHigh },
  offlineDot:  { backgroundColor: M3.outline },
  offlineText: { color: M3.onSurfaceVariant },

  toast: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999 },
  toastInner: {
    margin: SPACING.md,
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1, borderColor: M3.outlineVariant,
    ...CARD_ELEVATION,
  },
  toastError: { backgroundColor: M3.errorContainer, borderColor: M3.error },
  toastText: { color: M3.onBackground, fontSize: FONT_SIZE.sm, fontWeight: '700', flex: 1 },
  toastTextError: { color: M3.onErrorContainer },

  listContent: { paddingHorizontal: SPACING.md, paddingBottom: 100, flexGrow: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 12, height: 48,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1, borderColor: M3.outlineVariant,
    ...CARD_ELEVATION,
  },
  searchInput: { flex: 1, color: M3.onBackground, fontSize: FONT_SIZE.md },

  pendingBanner: {
    backgroundColor: M3.tertiaryFixed, borderRadius: 12,
    padding: SPACING.sm, marginBottom: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: M3.tertiaryFixedDim,
  },
  pendingText: { color: M3.onTertiaryFixedVariant, fontSize: FONT_SIZE.xs, flex: 1 },

  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING['2xl'] },
});
