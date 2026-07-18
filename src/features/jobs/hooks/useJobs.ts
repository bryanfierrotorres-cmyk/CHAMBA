import React from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type QueryClient } from '@tanstack/react-query';

import { useEffect, useMemo, useRef } from 'react';

import {

  fetchJobs,

  fetchJobById,

  acceptJob,

  subscribeToWorkerRadarJobs,

  fetchWorkerAssignments,

  fetchAllJobs,

  fetchJobActive,

  startJob,

  completeJob,

  advanceOperationalPhase,

} from '../services/jobsService';

import { useJobStore } from '@store/jobStore';

import { useAuthStore } from '@store/authStore';

import { useAssignmentsStore } from '@store/assignmentsStore';

import {
  mergeAssignments,
  mergeRemoteWithOptimisticLocal,
  patchLocalJobStatus,
  getLocalAssignments,
} from '@utils/localAssignments';

import { QUERY_STALE_FEED_MS } from '@constants/queryCache';
import { JOB_KEYS, workerActiveCountKey } from './jobKeys';
export { JOB_KEYS, workerActiveCountKey };
import { isWorkerPendingClientSelection } from '@utils/jobActiveLimits';
import { fromDbJobCategory } from '@constants/chambaCategories';
import { workerCoversJobCategory } from '@utils/workerCategoryAccess';
import { syncProfileWithDatabase } from '@utils/profileSync';

import type {
  JobCategory,
  JobStatus,
  Job,
  JobAssignment,
  WorkerOperationalPhase,
} from '@/types';
import { phaseToJobStatus } from '@utils/workerOperationalPhase';
import { patchClientOrderRowInCache } from '@features/client/hooks/useClientOrders';



const ACTIVE_WORKER_JOB_STATUSES = new Set<JobStatus>(['open', 'taken', 'in_progress']);

/** True si la agenda puede cambiar (postulación pendiente, fases, aprobación cliente). */
export const workerAgendaNeedLivePoll = (assignments: JobAssignment[] | undefined): boolean =>
  !!assignments?.some(
    (a) =>
      isWorkerPendingClientSelection(a) ||
      (a.job?.status != null && ACTIVE_WORKER_JOB_STATUSES.has(a.job.status)),
  );



/** Sincroniza caché React Query + store local tras aceptar. */

export const syncAcceptedJobCache = async (

  assignment: JobAssignment,

  jobSnapshot: Job | null | undefined,

  queryClient: QueryClient,

): Promise<string> => {

  const workerId = useAuthStore.getState().profile?.id ?? assignment.worker_id;

  await useAssignmentsStore.getState().addAssignment(

    assignment,

    assignment.job ?? jobSnapshot ?? null,

  );

  queryClient.setQueryData<JobAssignment[]>(

    JOB_KEYS.myJobs(workerId),

    (old: JobAssignment[] | undefined) => mergeAssignments(old ?? [], [assignment]),

  );

  return workerId;

};



/** Infinite-scroll job feed for workers. */

export const useJobFeed = (

  status: JobStatus = 'open',

  category?: JobCategory,

  categories?: JobCategory[],

  onWorkerApproved?: (job: Job) => void,

) => {

  const { upsertJob, removeJob } = useJobStore();

  const profile = useAuthStore((s) => s.profile);

  const queryClient = useQueryClient();

  // Stable ref so the Realtime callback always calls the latest handler without restarting the subscription
  const onWorkerApprovedRef = useRef(onWorkerApproved);
  useEffect(() => { onWorkerApprovedRef.current = onWorkerApproved; }, [onWorkerApproved]);



  const query = useInfiniteQuery({

    queryKey: [...JOB_KEYS.feed(status, category), categories, profile?.id, profile?.is_approved],

    queryFn: async ({ pageParam = 0 }) => {
      let workerId: string | undefined;
      if (profile?.role === 'worker' && profile) {
        workerId = profile.id;
        return fetchJobs({
          status,
          category,
          categories,
          page: pageParam as number,
          workerId,
        });
      }
      return fetchJobs({
        status,
        category,
        categories,
        page: pageParam as number,
      });
    },

    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),

    initialPageParam: 0,

    enabled: profile?.role !== 'worker' || !!profile?.id,

    staleTime: QUERY_STALE_FEED_MS,

    refetchOnWindowFocus: false,

    refetchOnMount: true,

    // Fallback poll — keeps the feed alive if Realtime WebSocket drops
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,

  });



  const dispatchTimeoutsRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {

    if (profile?.role !== 'worker' || !profile.id) return undefined;

    let cancelled = false;

    let teardown: (() => void) | undefined;

    const feedQueryKey = [
      ...JOB_KEYS.feed(status, category),
      categories,
      profile.id,
      profile.is_approved,
    ] as const;

    const jobMatchesFeed = (job: Job): boolean => {
      if (job.status !== status) return false;
      if (categories !== undefined && categories.length === 0) return false;

      const jobSlug = fromDbJobCategory(job.category) ?? job.category;
      if (categories && categories.length > 0 && !categories.includes(jobSlug as JobCategory)) {
        return false;
      }
      return workerCoversJobCategory(profile, job.category);
    };

    const start = async () => {
      // Subscribe immediately — don't block on profile sync to avoid missing early events
      teardown = subscribeToWorkerRadarJobs(({ job, eventType }) => {
        const timeoutMap = dispatchTimeoutsRef.current;
        if (eventType === 'DELETE' || job.status !== 'open') {
          // Si el técnico ya aplicó a este job (está en pending_bidding),
          // lo actualizamos en el store pero NO lo quitamos del radar.
          const workerHasApplication = useAssignmentsStore
            .getState()
            .items.some((a) => a.job_id === job.id);

          if (timeoutMap.has(job.id)) {
            clearTimeout(timeoutMap.get(job.id)!);
            timeoutMap.delete(job.id);
          }

          if (workerHasApplication && job.status === 'pending_bidding') {
            // Mantener en radar con estado actualizado para mostrar "awaitingClientChoice"
            upsertJob(job);
          } else if (workerHasApplication && job.status === 'taken') {
            const currentWorkerId = useAuthStore.getState().profile?.id;
            if (job.assigned_worker_id && job.assigned_worker_id === currentWorkerId) {
              // Este técnico fue el elegido — mantener en store y notificar al HomeScreen
              upsertJob(job);
              onWorkerApprovedRef.current?.(job);
            } else {
              // Otro técnico fue seleccionado — quitar del radar silenciosamente
              removeJob(job.id);
            }
          } else {
            removeJob(job.id);
          }
          void queryClient.invalidateQueries({ queryKey: feedQueryKey });
          return;
        }

        if (!jobMatchesFeed(job)) return;

        upsertJob(job);
        void queryClient.invalidateQueries({ queryKey: feedQueryKey });
      });

      // Sync profile in parallel — update store if approval/categories changed
      const synced = await syncProfileWithDatabase(profile);
      if (cancelled) return;
      if (synced.id !== profile.id || synced.is_approved !== profile.is_approved) {
        useAuthStore.getState().setProfile(synced);
      }
    };

    void start();

    return () => {
      cancelled = true;
      teardown?.();
      teardown = undefined;
      dispatchTimeoutsRef.current.forEach(clearTimeout);
      dispatchTimeoutsRef.current.clear();
    };

  }, [
    profile?.id,
    profile?.role,
    profile?.is_approved,
    profile?.category_1,
    profile?.category_2,
    profile?.category_1_approved,
    profile?.category_2_approved,
    categories,
    category,
    status,
    upsertJob,
    removeJob,
    queryClient,
  ]);



  return query;

};



export const useJobDetail = (jobId: string) =>

  useQuery({

    queryKey: JOB_KEYS.detail(jobId),

    queryFn: () => fetchJobById(jobId),

    enabled: !!jobId,

    staleTime: QUERY_STALE_FEED_MS,

  });



/** Worker's accepted jobs — caché local + remoto unificados. */

export const useMyJobs = () => {

  const profile = useAuthStore((s) => s.profile);

  const storeItems = useAssignmentsStore((s) => s.items);

  const refreshStore = useAssignmentsStore((s) => s.refresh);

  const storeLoading = useAssignmentsStore((s) => s.isLoading);



  useEffect(() => {

    if (profile?.id) {

      void refreshStore(profile.id);

    }

  }, [profile?.id, refreshStore]);



  const query = useQuery<JobAssignment[]>({

    queryKey: JOB_KEYS.myJobs(profile?.id ?? ''),

    queryFn: async () => {
      if (!profile?.id) return [];
      const synced = await syncProfileWithDatabase(profile);
      if (synced.id !== profile.id || synced.is_approved !== profile.is_approved) {
        useAuthStore.getState().setProfile(synced);
      }
      return fetchWorkerAssignments(synced.id, null);
    },

    enabled: !!profile?.id && profile.role === 'worker',

    staleTime: QUERY_STALE_FEED_MS,

    refetchOnWindowFocus: false,

    refetchOnMount: true,

    refetchInterval: (query) =>
      workerAgendaNeedLivePoll(query.state.data) ? 10_000 : false,

    refetchIntervalInBackground: true,

    // Keep previous data visible while refetching — prevents card flicker
    placeholderData: (previousData) => previousData ?? (storeItems.length > 0 ? storeItems : undefined),

  });



  const data = useMemo(() => {
    const remote = query.data ?? [];
    if (remote.length > 0) {
      return mergeRemoteWithOptimisticLocal(remote, storeItems);
    }
    return storeItems.length > 0 ? storeItems : remote;
  }, [query.data, storeItems]);



  return {

    ...query,

    data,

    isLoading: (query.isLoading || storeLoading) && data.length === 0,

  };

};



export const useAllJobs = () =>

  useQuery<Job[]>({

    queryKey: JOB_KEYS.adminAll(),

    queryFn: fetchAllJobs,

  });



export const useActiveJob = (jobId: string) => {

  const profile = useAuthStore((s) => s.profile);

  return useQuery({

    queryKey: [...JOB_KEYS.detail(jobId), 'active', profile?.id],

    queryFn: () => fetchJobActive(jobId, profile!.id),

    enabled: !!jobId && !!profile?.id,

    staleTime: 10_000,

    retry: 0,

  });

};



export const useStartJob = () => {

  const profile = useAuthStore((s) => s.profile);



  return useMutation({

    mutationFn: (jobId: string) => startJob(jobId, profile?.id),

    onSuccess: (_data, _jobId) => {
      // Opt-out of invalidateQueries to avoid race conditions with optimistic cache/Realtime
    },

  });

};



export const useAdvanceOperationalPhase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      jobId,
      nextPhase,
      job,
      workerId,
    }: {
      jobId: string;
      nextPhase: WorkerOperationalPhase;
      job?: Job | Partial<Job> | null;
      workerId?: string;
    }) => {
      const currentProfile = useAuthStore.getState().profile;
      const effectiveWorkerId = workerId ?? currentProfile?.id;
      if (!effectiveWorkerId) {
        return Promise.reject(new Error('Sesión de técnico requerida'));
      }
      return advanceOperationalPhase(
        jobId,
        effectiveWorkerId,
        nextPhase,
        job as Job | null,
        currentProfile,
      );
    },

    onMutate: async ({ jobId, nextPhase, workerId }) => {
      const status = phaseToJobStatus(nextPhase);
      const profileId = useAuthStore.getState().profile?.id;
      const patchWorkerId = workerId ?? profileId;
      const now = new Date().toISOString();

      // 1. Patch Zustand store (by composite key and by match)
      if (patchWorkerId) {
        useAssignmentsStore.getState().patchItem(
          `${jobId}-${patchWorkerId}`,
          {},
          { operational_phase: nextPhase, status, updated_at: now },
        );
      }
      const items = useAssignmentsStore.getState().items;
      const match = items.find((a) => a.job_id === jobId);
      if (match) {
        useAssignmentsStore.getState().patchItem(
          match.id,
          {},
          { operational_phase: nextPhase, status, updated_at: now },
        );
      }

      // 2. Patch React Query cache directly — instant UI update
      const effectiveWorkerId = patchWorkerId ?? profileId;
      if (effectiveWorkerId) {
        queryClient.setQueryData<JobAssignment[]>(
          JOB_KEYS.myJobs(effectiveWorkerId),
          (old: JobAssignment[] | undefined) =>
            (old ?? []).map((a: JobAssignment) =>
              a.job_id === jobId
                ? {
                    ...a,
                    job: a.job
                      ? {
                          ...a.job,
                          status,
                          operational_phase: nextPhase,
                          updated_at: now,
                        }
                      : a.job,
                  }
                : a,
            ),
        );
      }

      // 3. Patch detail queries (used by JobActiveScreen)
      queryClient.setQueryData<Job>(
        JOB_KEYS.detail(jobId),
        (old: Job | undefined) => old ? { ...old, status, operational_phase: nextPhase, updated_at: now } : old
      );

      if (profileId) {
        queryClient.setQueryData<{ job: Job, assignment: JobAssignment }>(
          [...JOB_KEYS.detail(jobId), 'active', profileId],
          (old: { job: Job, assignment: JobAssignment } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              job: { ...old.job, status, operational_phase: nextPhase, updated_at: now },
            };
          }
        );
      }

      await patchLocalJobStatus(jobId, status, undefined, nextPhase);
    },

    onSettled: () => {
      // Optimistic updates are already in place, avoid refetching right away to prevent flicker.
    },
  });
};

export const useCompleteJob = () => {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: ({
      jobId,
      assignmentId,
      job,
    }: {
      jobId: string;
      assignmentId: string;
      job?: Job | Partial<Job> | null;
    }) => completeJob(jobId, assignmentId, profile?.id, job, profile),

    onMutate: async ({ jobId, assignmentId, job }) => {
      const now = new Date().toISOString();
      const clientId = job?.created_by;
      useAssignmentsStore.getState().patchItem(
        assignmentId,
        { completed_at: now },
        { status: 'completed', operational_phase: 'completed', updated_at: now },
      );
      if (profile?.id) {
        queryClient.setQueryData<JobAssignment[]>(
          JOB_KEYS.myJobs(profile.id),
          (old: JobAssignment[] | undefined) =>
            (old ?? []).map((a: JobAssignment) =>
              a.id === assignmentId
                ? {
                    ...a,
                    completed_at: now,
                    job: a.job
                      ? {
                          ...a.job,
                          status: 'completed' as const,
                          operational_phase: 'completed' as const,
                          updated_at: now,
                        }
                      : a.job,
                  }
                : a,
            ),
        );
        
        queryClient.setQueryData<{ job: Job, assignment: JobAssignment }>(
          [...JOB_KEYS.detail(jobId), 'active', profile.id],
          (old: { job: Job, assignment: JobAssignment } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              assignment: { ...old.assignment, completed_at: now },
              job: { ...old.job, status: 'completed' as const, operational_phase: 'completed' as const, updated_at: now },
            };
          }
        );
      }
      
      queryClient.setQueryData<Job>(
        JOB_KEYS.detail(jobId),
        (old: Job | undefined) => old ? { ...old, status: 'completed' as const, operational_phase: 'completed' as const, updated_at: now } : old
      );

      if (clientId) {
        patchClientOrderRowInCache(queryClient, clientId, {
          id: jobId,
          status: 'completed',
          operational_phase: 'completed',
          updated_at: now,
        });
      }
      await patchLocalJobStatus(jobId, 'completed', now, 'completed');
    },

    onSettled: () => {
      // Prevents UI flicker by keeping optimistic data until Realtime Sync
    },
  });
};



/** Accept job — único camino para HomeScreen y JobDetailScreen. */

export const useAcceptJob = () => {

  const queryClient = useQueryClient();

  const { setLoadingAccept } = useJobStore();

  const profile = useAuthStore((s) => s.profile);



  return useMutation({
    mutationFn: async ({ jobId, job, counterOfferAmount }: { jobId: string; job?: Job | null, counterOfferAmount?: number | null }) => {
      try {
        return await acceptJob(jobId, profile!.id, profile ?? undefined, job ?? null, counterOfferAmount);

      } catch (err) {

        const workerId = useAuthStore.getState().profile?.id ?? profile!.id;

        const local = (await getLocalAssignments(workerId)).find((a) => a.job_id === jobId);

        if (local) {

          return { success: true, assignmentId: local.id, assignment: local };

        }

        throw err;

      }

    },



    onMutate: () => setLoadingAccept(true),



    onSuccess: async (data, { job }) => {

      if (data.assignment) {

        await syncAcceptedJobCache(data.assignment, job, queryClient);

      }
      // No invalidateQueries immediately after to let Optimistic Sync handle UI without flickering
    },



    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('quota') || msg.includes('Quota') || msg.includes('Storage')) {
        console.warn('[AcceptJob] storage quota — chamba guardada en memoria');
        return;
      }
      console.error('[AcceptJob] Error:', err);
    },



    onSettled: () => setLoadingAccept(false),

  });

};


