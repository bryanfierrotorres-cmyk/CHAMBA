import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type QueryClient } from '@tanstack/react-query';

import { useEffect, useMemo } from 'react';

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

import { mergeAssignments, patchLocalJobStatus, getLocalAssignments } from '@utils/localAssignments';

import { CONFIG } from '@constants/config';
import { workerActiveCountKey } from '@features/jobs/hooks/useJobActiveLimits';
import { fromDbJobCategory } from '@constants/chambaCategories';
import { workerCoversJobCategory } from '@utils/workerCategoryAccess';
import { syncProfileWithDatabase } from '@utils/profileSync';
import { ensurePhoneAuthSession } from '@utils/phoneAuthSession';

import type {
  JobCategory,
  JobStatus,
  Job,
  JobAssignment,
  WorkerOperationalPhase,
} from '@/types';
import { phaseToJobStatus } from '@utils/workerOperationalPhase';



export const JOB_KEYS = {

  all: ['jobs'] as const,

  feed: (status?: JobStatus, category?: JobCategory) =>

    ['jobs', 'feed', status, category] as const,

  detail: (id: string) => ['jobs', id] as const,

  myJobs: (workerId: string) => ['jobs', 'my', workerId] as const,

  adminAll: () => ['jobs', 'admin', 'all'] as const,

  clientOrders: (userId: string) => ['client-orders', userId] as const,

  adminControl: () => ['admin', 'control', 'jobs'] as const,

};



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

) => {

  const { upsertJob, removeJob } = useJobStore();

  const profile = useAuthStore((s) => s.profile);

  const queryClient = useQueryClient();



  const query = useInfiniteQuery({

    queryKey: [...JOB_KEYS.feed(status, category), categories, profile?.id, profile?.is_approved],

    queryFn: async ({ pageParam = 0 }) =>
      fetchJobs({
        status,
        category,
        categories,
        page: pageParam as number,
        workerId: profile?.role === 'worker' ? profile.id : undefined,
      }),

    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),

    initialPageParam: 0,

    enabled: profile?.role !== 'worker' || !!profile?.id,

    staleTime: 15_000,

    refetchOnMount: true,

  });



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
      const synced = await syncProfileWithDatabase(profile);
      if (cancelled) return;

      if (synced.id !== profile.id || synced.is_approved !== profile.is_approved) {
        useAuthStore.getState().setProfile(synced);
      }

      await ensurePhoneAuthSession(synced);
      if (cancelled) return;

      teardown = subscribeToWorkerRadarJobs(({ job, eventType }) => {
        if (eventType === 'DELETE' || job.status !== 'open') {
          removeJob(job.id);
          void queryClient.invalidateQueries({ queryKey: feedQueryKey });
          return;
        }

        if (!jobMatchesFeed(job)) return;

        upsertJob(job);
        void queryClient.invalidateQueries({ queryKey: feedQueryKey });
      });
    };

    void start();

    return () => {
      cancelled = true;
      teardown?.();
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

    staleTime: 10_000,

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

    queryFn: () => fetchWorkerAssignments(profile!.id),

    enabled: !!profile?.id,

    staleTime: 5_000,

    refetchOnMount: true,

    placeholderData: (previousData) => previousData ?? storeItems,

  });



  const data = useMemo(

    () => mergeAssignments(query.data ?? [], storeItems),

    [query.data, storeItems],

  );



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

  });

};



export const useStartJob = () => {

  const queryClient = useQueryClient();

  const profile = useAuthStore((s) => s.profile);



  return useMutation({

    mutationFn: (jobId: string) => startJob(jobId, profile?.id),

    onSuccess: (_data, jobId) => {

      queryClient.invalidateQueries({ queryKey: JOB_KEYS.all });

      queryClient.invalidateQueries({ queryKey: JOB_KEYS.detail(jobId) });

      if (profile?.id) {

        queryClient.invalidateQueries({ queryKey: JOB_KEYS.myJobs(profile.id) });

      }

      queryClient.invalidateQueries({ queryKey: ['client-orders'] });

      queryClient.invalidateQueries({ queryKey: JOB_KEYS.adminControl() });

    },

  });

};



export const useAdvanceOperationalPhase = () => {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: ({
      jobId,
      nextPhase,
      job,
    }: {
      jobId: string;
      nextPhase: WorkerOperationalPhase;
      job?: Job | Partial<Job> | null;
    }) => advanceOperationalPhase(jobId, profile!.id, nextPhase, job as Job | null),

    onMutate: async ({ jobId, nextPhase }) => {
      const status = phaseToJobStatus(nextPhase);
      useAssignmentsStore.getState().patchItem(
        `${jobId}-${profile?.id}`,
        {},
        { operational_phase: nextPhase, status, updated_at: new Date().toISOString() },
      );
      const items = useAssignmentsStore.getState().items;
      const match = items.find((a) => a.job_id === jobId);
      if (match) {
        useAssignmentsStore.getState().patchItem(
          match.id,
          {},
          { operational_phase: nextPhase, status, updated_at: new Date().toISOString() },
        );
      }
      await patchLocalJobStatus(jobId, status, undefined, nextPhase);
    },

    onSettled: (_data, _err, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: JOB_KEYS.all });
      queryClient.invalidateQueries({ queryKey: JOB_KEYS.detail(jobId) });
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: JOB_KEYS.myJobs(profile.id) });
        queryClient.invalidateQueries({ queryKey: workerActiveCountKey(profile.id) });
      }
      queryClient.invalidateQueries({ queryKey: ['client-orders'] });
    },
  });
};

export const useCompleteJob = () => {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: ({ jobId, assignmentId }: { jobId: string; assignmentId: string }) =>
      completeJob(jobId, assignmentId, profile?.id),

    onMutate: async ({ jobId, assignmentId }) => {
      const now = new Date().toISOString();
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
      }
      await patchLocalJobStatus(jobId, 'completed', now);
    },

    onSettled: (_data, _err, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: JOB_KEYS.adminControl() });
      queryClient.invalidateQueries({ queryKey: JOB_KEYS.detail(jobId) });
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: workerActiveCountKey(profile.id) });
      }
    },
  });
};



/** Accept job — único camino para HomeScreen y JobDetailScreen. */

export const useAcceptJob = () => {

  const queryClient = useQueryClient();

  const { setLoadingAccept } = useJobStore();

  const profile = useAuthStore((s) => s.profile);



  return useMutation({

    mutationFn: async ({ jobId, job }: { jobId: string; job?: Job | null }) => {

      try {

        return await acceptJob(jobId, profile!.id, profile ?? undefined, job ?? null);

      } catch (err) {

        if (!CONFIG.pilot.enabled) throw err;

        const workerId = useAuthStore.getState().profile?.id ?? profile!.id;

        const local = (await getLocalAssignments(workerId)).find((a) => a.job_id === jobId);

        if (local) {

          return { success: true, assignmentId: local.id, assignment: local };

        }

        throw err;

      }

    },



    onMutate: () => setLoadingAccept(true),



    onSuccess: async (data, { jobId, job }) => {

      if (data.assignment) {

        await syncAcceptedJobCache(data.assignment, job, queryClient);

      }

      queryClient.invalidateQueries({ queryKey: JOB_KEYS.all });

      queryClient.invalidateQueries({ queryKey: JOB_KEYS.detail(jobId) });

      queryClient.invalidateQueries({ queryKey: ['client-orders'] });

      queryClient.invalidateQueries({ queryKey: JOB_KEYS.adminControl() });

      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: workerActiveCountKey(profile.id) });
      }

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


