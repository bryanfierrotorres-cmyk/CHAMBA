import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, Animated, StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { CompactJobCard } from '@components/worker/radar/CompactJobCard';
import { RADAR_BORDER, RADAR_DEEP_BLUE, RADAR_MUTED } from '@components/worker/radar/radarTheme';
import { RadarFullMap } from '@components/worker/radar/RadarFullMap';
import { FloatingRadarHeader } from '@components/worker/radar/FloatingRadarHeader';
import { FloatingRadarFilters } from '@components/worker/radar/FloatingRadarFilters';
import { JobBottomSheet } from '@components/worker/radar/JobBottomSheet';
import { useJobFeed, JOB_KEYS, useAcceptJob } from '../hooks/useJobs';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { useJobStore } from '@store/jobStore';
import { FONT_SIZE, SPACING } from '@constants/workerTheme';
import { CARD_ELEVATION } from '@constants/stitchStyles';
import { sortServiceTypesByConfig } from '@constants/servicesConfig';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import type { ServiceType } from '@features/catalog/types';
import {
  expandWorkerFeedCategories,
  getWorkerApprovedCategories,
  getWorkerFeedCategories,
  workerCoversJobCategory,
} from '@utils/workerCategoryAccess';
import { useAssignmentsStore } from '@store/assignmentsStore';
import { getLocalAssignments } from '@utils/localAssignments';
import { useWorkerCommitmentLimit } from '@features/jobs/hooks/useJobActiveLimits';
import {
  clearRadarDismissedJobs,
  dismissRadarJob,
  loadRadarDismissedJobIds,
} from '@utils/radarDismissedJobs';
import type { Job, JobCategory, JobStackParamList, WorkerTabParamList } from '@/types';

type StackNav = NativeStackNavigationProp<JobStackParamList, 'JobList'>;

type CategoryItem = { value: string; label: string };

const FLOATING_HEADER_HEIGHT = 68;
const FILTERS_GAP = 10;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ToastType = 'success' | 'error';
interface ToastData { type: ToastType; message: string; }

const useToast = () => {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<ToastData>({ type: 'success', message: '' });
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

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

interface FeedItemProps {
  job: Job;
  isApproved: boolean;
  acceptingJobId: string | null;
  acceptedJobIds: Set<string>;
  processJobIds: Set<string>;
  awaitingClientChoice: boolean;
  acceptBlocked: boolean;
  onPressDetail: () => void;
  onAccept: (job: Job) => Promise<void>;
  onDismiss: (job: Job) => void;
  canDismiss: boolean;
}

const FeedItem: React.FC<FeedItemProps> = ({
  job, isApproved, acceptingJobId, acceptedJobIds, processJobIds, awaitingClientChoice,
  acceptBlocked,
  onPressDetail, onAccept, onDismiss, canDismiss,
}) => (
  <CompactJobCard
    job={job}
    onPressDetail={onPressDetail}
    onDismiss={() => onDismiss(job)}
    onAccept={() => onAccept(job)}
    canDismiss={canDismiss}
    canAccept={isApproved && !awaitingClientChoice}
    isAccepting={acceptingJobId === job.id}
    awaitingClientChoice={awaitingClientChoice}
    isAccepted={acceptedJobIds.has(job.id) && !processJobIds.has(job.id)}
    acceptBlocked={acceptBlocked}
  />
);

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<StackNav>();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const workerProfile = useProfileStore((s) => s.workerProfile);
  const { jobs: storeJobs } = useJobStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { mutateAsync: acceptMut } = useAcceptJob();
  const workerLimit = useWorkerCommitmentLimit();

  useFocusEffect(
    useCallback(() => {
      if (profile?.role !== 'worker' || !profile.id) return;
      void workerLimit.refetch();
    }, [profile?.id, profile?.role, workerLimit.refetch]),
  );

  const [selectedCategory, setSelectedCategory] = useState<JobCategory | null>(null);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [acceptedJobIds, setAcceptedJobIds] = useState<Set<string>>(new Set());
  const [processJobIds, setProcessJobIds] = useState<Set<string>>(new Set());
  const [removedFromFeedIds, setRemovedFromFeedIds] = useState<Set<string>>(new Set());
  const [pendingApplicationIds, setPendingApplicationIds] = useState<Set<string>>(new Set());
  const acceptingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.id || profile.role !== 'worker') return;
    void (async () => {
      const local = await getLocalAssignments(profile.id);
      const pending = local
        .filter((a) => a.job?.status === 'open')
        .map((a) => a.job_id);
      if (pending.length > 0) {
        setPendingApplicationIds(new Set(pending));
      }
      const dismissed = await loadRadarDismissedJobIds(profile.id);
      if (dismissed.size > 0) {
        setRemovedFromFeedIds(dismissed);
      }
    })();
  }, [profile?.id, profile?.role]);

  const catalog = useCatalog();

  const approvedCategories = useMemo(
    () => getWorkerApprovedCategories(profile),
    [profile],
  );

  const feedCategories = useMemo(
    () => getWorkerFeedCategories(profile),
    [profile],
  );

  const filterChips = useMemo<CategoryItem[]>(() => {
    const allowed = new Set(feedCategories);
    return sortServiceTypesByConfig(
      catalog.serviceTypes.filter((t: ServiceType) => allowed.has(t.slug)) as ServiceType[],
    ).map((t) => ({
      value: t.slug,
      label: t.name.trim(),
    }));
  }, [catalog.serviceTypes, feedCategories]);

  const effectiveCategories = useMemo<JobCategory[] | undefined>(() => {
    if (!profile?.is_approved) return undefined;
    if (selectedCategory) {
      if (!approvedCategories.includes(selectedCategory)) return [];
      return expandWorkerFeedCategories([selectedCategory]);
    }
    return feedCategories.length > 0 ? feedCategories : undefined;
  }, [selectedCategory, approvedCategories, feedCategories, profile?.is_approved]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJobFeed('open', undefined, effectiveCategories);

  // Precargar páginas adicionales para el radar (todos los marcadores en mapa).
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data?.pages.length]);

  const queryJobs = useMemo(() => {
    const seen = new Map<string, Job>();
    for (const j of data?.pages.flatMap((p) => p.data) ?? []) {
      if (!seen.has(j.id)) seen.set(j.id, j);
    }
    return Array.from(seen.values());
  }, [data]);

  const storeMap = useMemo(() => new Map(storeJobs.map((j) => [j.id, j])), [storeJobs]);

  const feedJobs = useMemo(() => {
    const filterByCategory = effectiveCategories && effectiveCategories.length > 0;
    const byId = new Map<string, Job>();

    for (const j of queryJobs) {
      if (removedFromFeedIds.has(j.id)) continue;
      if (filterByCategory && !workerCoversJobCategory(profile, j.category)) continue;
      byId.set(j.id, storeMap.get(j.id) ?? j);
    }

    for (const raw of storeJobs) {
      if (byId.has(raw.id)) continue;
      if (filterByCategory && !workerCoversJobCategory(profile, raw.category)) continue;
      if (raw.status !== 'open' && !processJobIds.has(raw.id)) continue;
      if (removedFromFeedIds.has(raw.id)) continue;
      byId.set(raw.id, storeMap.get(raw.id) ?? raw);
    }

    return Array.from(byId.values()).filter(
      (j) => j.status === 'open' || acceptedJobIds.has(j.id) || processJobIds.has(j.id),
    ).filter((j) => !removedFromFeedIds.has(j.id));
  }, [
    queryJobs,
    storeMap,
    storeJobs,
    acceptedJobIds,
    processJobIds,
    removedFromFeedIds,
    effectiveCategories,
    profile,
  ]);

  const prevFeedCountRef = useRef(feedJobs.length);
  useEffect(() => {
    if (prevFeedCountRef.current === 0 && feedJobs.length > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    prevFeedCountRef.current = feedJobs.length;
  }, [feedJobs.length]);

  const handleAccept = useCallback(async (job: Job) => {
    if (!profile?.id || !profile.is_approved) return;
    if (workerLimit.atLimit) {
      toast.show({ type: 'error', message: workerLimit.message }, 4000);
      return;
    }
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
      const result = await acceptMut({ jobId: job.id, job });
      if (result.pendingClientSelection) {
        setPendingApplicationIds((prev) => new Set([...prev, job.id]));
        toast.show({
          type: 'success',
          message: '📨 Postulación enviada. El cliente revisará tu perfil y te elegirá.',
        }, 3200);
      } else {
        setAcceptedJobIds((prev) => new Set([...prev, job.id]));
        toast.show({ type: 'success', message: '✅ ¡Chamba asignada!' }, 2200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const isStorage = msg.includes('quota') || msg.includes('Quota') || msg.includes('Storage');
      const isConcurrency =
        msg.includes('lock') ||
        msg.includes('taken') ||
        msg.includes('tomado') ||
        msg.includes('NOWAIT') ||
        msg.includes('3 técnicos');
      if (!isStorage) {
        toast.show({
          type: 'error',
          message: isConcurrency
            ? '⚡ Ya no hay cupo o el cliente ya eligió técnico'
            : msg || 'No se pudo postular',
        }, 3500);
      }
    } finally {
      acceptingRef.current.delete(job.id);
      setAcceptingJobId(null);
    }
  }, [profile, acceptMut, toast, acceptingJobId, acceptedJobIds, processJobIds, workerLimit.atLimit, workerLimit.message]);

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

  const handleDismiss = useCallback((job: Job) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRemovedFromFeedIds((prev) => new Set([...prev, job.id]));
    if (profile?.id) {
      void dismissRadarJob(profile.id, job.id);
    }
    toast.show({
      type: 'success',
      message: 'Solicitud apartada — deslizá menos prioritarias para enfocarte en las importantes',
    }, 2600);
  }, [profile?.id, toast]);

  const dismissedCount = removedFromFeedIds.size;

  const handleRestoreDismissed = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRemovedFromFeedIds(new Set());
    if (profile?.id) {
      void clearRadarDismissedJobs(profile.id);
    }
    toast.show({ type: 'success', message: 'Solicitudes apartadas restauradas en el radar' }, 2400);
  }, [profile?.id, toast]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isApproved = !!profile?.is_approved;
  const availability = workerProfile?.availability_status ?? 'offline';
  const isOnline = availability === 'available';

  const filtersTopOffset =
    insets.top + 8 + FLOATING_HEADER_HEIGHT + FILTERS_GAP;

  const sheetListHeader = (
    <>
      {!isApproved && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={14} color={RADAR_MUTED} />
          <Text style={styles.pendingText}>
            Cuenta pendiente de aprobación — solo puedes ver las solicitudes
          </Text>
        </View>
      )}
      {isApproved && !workerLimit.isLoading && workerLimit.atLimit && (
        <View style={styles.limitBanner}>
          <Ionicons name="information-circle-outline" size={16} color={RADAR_DEEP_BLUE} />
          <Text style={styles.limitBannerText}>
            {workerLimit.message} Los trabajos siguen visibles en el radar.
          </Text>
        </View>
      )}
      {isApproved && dismissedCount > 0 && (
        <Pressable
          style={styles.dismissedBanner}
          onPress={handleRestoreDismissed}
          accessibilityRole="button"
          accessibilityLabel="Restaurar solicitudes apartadas"
        >
          <Ionicons name="arrow-undo-outline" size={16} color={RADAR_DEEP_BLUE} />
          <Text style={styles.dismissedBannerText}>
            {dismissedCount} apartada{dismissedCount === 1 ? '' : 's'} · Tocá para restaurar
          </Text>
        </Pressable>
      )}
      {isApproved && feedJobs.length > 0 && dismissedCount === 0 && (
        <View style={styles.swipeHintBanner}>
          <Ionicons name="list-outline" size={15} color={RADAR_MUTED} />
          <Text style={styles.swipeHintText}>
            Deslizá la lista para ver más solicitudes · Tocá ✕ para apartar
          </Text>
        </View>
      )}
    </>
  );

  const renderJob = useCallback((job: Job) => {
    const awaitingClientChoice = pendingApplicationIds.has(job.id);
    const canDismiss =
      isApproved
      && !awaitingClientChoice
      && !acceptedJobIds.has(job.id)
      && !processJobIds.has(job.id)
      && acceptingJobId !== job.id
      && job.status === 'open';

    return (
      <FeedItem
        job={job}
        isApproved={isApproved}
        acceptingJobId={acceptingJobId}
        acceptedJobIds={acceptedJobIds}
        processJobIds={processJobIds}
        awaitingClientChoice={awaitingClientChoice}
        acceptBlocked={
          !workerLimit.isLoading
          && workerLimit.atLimit
          && !awaitingClientChoice
        }
        onPressDetail={() => navigation.navigate('JobDetail', { jobId: job.id })}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
        canDismiss={canDismiss}
      />
    );
  }, [
    isApproved,
    acceptingJobId,
    acceptedJobIds,
    processJobIds,
    pendingApplicationIds,
    workerLimit.isLoading,
    workerLimit.atLimit,
    navigation,
    handleAccept,
    handleDismiss,
  ]);

  const emptyHint = selectedCategory
    ? `Filtrando por ${catalog.getLabel(selectedCategory)}`
    : undefined;

  return (
    <View style={styles.root}>
      <RadarFullMap
        jobs={feedJobs}
        searchHint={emptyHint}
        isSearching={isOnline && isApproved}
      />

      <FloatingRadarHeader
        topInset={insets.top}
        avatarUri={profile?.avatar_url}
        fullName={profile?.full_name}
        isOnline={isOnline}
      />

      {filterChips.length > 0 && (
        <FloatingRadarFilters
          topOffset={filtersTopOffset}
          items={filterChips.map((c) => ({ slug: c.value, label: c.label }))}
          selectedSlug={selectedCategory}
          onSelect={(slug) => setSelectedCategory(slug as JobCategory | null)}
        />
      )}

      {toast.visible && (
        <Animated.View
          style={[styles.toast, { top: insets.top + 8, transform: [{ translateY: toast.translateY }] }]}
          pointerEvents="none"
        >
          <View style={[styles.toastInner, toast.data.type === 'error' && styles.toastError]}>
            <Ionicons
              name={toast.data.type === 'success' ? 'checkmark-circle' : 'warning-outline'}
              size={22}
              color={toast.data.type === 'success' ? RADAR_DEEP_BLUE : '#DC2626'}
            />
            <Text style={[styles.toastText, toast.data.type === 'error' && styles.toastTextError]}>
              {toast.data.message}
            </Text>
          </View>
        </Animated.View>
      )}

      <JobBottomSheet
        jobs={feedJobs}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        onEndReached={handleEndReached}
        listHeader={sheetListHeader}
        renderJob={renderJob}
        emptyHint={emptyHint}
      />
    </View>
  );
};

/** Alias semántico — radar operativo del técnico. */
export const TechnicalRadarScreen = HomeScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 30,
  },
  toastInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    ...CARD_ELEVATION,
  },
  toastError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  toastText: {
    color: '#111827',
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    flex: 1,
  },
  toastTextError: {
    color: '#991B1B',
  },
  pendingBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingText: {
    color: '#92400E',
    fontSize: FONT_SIZE.xs,
    flex: 1,
    lineHeight: 17,
  },
  limitBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
  },
  limitBannerText: {
    color: RADAR_DEEP_BLUE,
    fontSize: FONT_SIZE.xs,
    flex: 1,
    lineHeight: 18,
  },
  dismissedBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  dismissedBannerText: {
    color: RADAR_DEEP_BLUE,
    fontSize: FONT_SIZE.xs,
    flex: 1,
    lineHeight: 18,
    fontWeight: '600',
  },
  swipeHintBanner: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
  },
  swipeHintText: {
    color: RADAR_MUTED,
    fontSize: FONT_SIZE.xs,
    flex: 1,
    lineHeight: 17,
  },
});
