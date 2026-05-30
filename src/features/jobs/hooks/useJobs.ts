import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type QueryClient } from '@tanstack/react-query';

import { useEffect, useMemo } from 'react';

import {

  fetchJobs,

  fetchJobById,

  acceptJob,

  subscribeToJobs,

  fetchWorkerAssignments,

  fetchAllJobs,

  fetchJobActive,

  startJob,

  completeJob,

} from '../services/jobsService';

import { useJobStore } from '@store/jobStore';

import { useAuthStore } from '@store/authStore';

import { useAssignmentsStore } from '@store/assignmentsStore';

import { mergeAssignments, patchLocalJobStatus, getLocalAssignments } from '@utils/localAssignments';

import { CONFIG } from '@constants/config';

import type { JobCategory, JobStatus, Job, JobAssignment } from '@/types';



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

    (old) => mergeAssignments(old ?? [], [assignment]),

  );

  return workerId;

};



/** Infinite-scroll job feed for workers. */

export const useJobFeed = (

  status: JobStatus = 'open',

  category?: JobCategory,

  categories?: JobCategory[],

) => {

  const { upsertJob } = useJobStore();



  const query = useInfiniteQuery({

    queryKey: [...JOB_KEYS.feed(status, category), categories],

    queryFn: ({ pageParam = 0 }) =>

      fetchJobs({ status, category, categories, page: pageParam as number }),

    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),

    initialPageParam: 0,

  });



  useEffect(() => {

    const unsub = subscribeToJobs(upsertJob);

    return () => { void unsub(); };

  }, [upsertJob]);



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

    refetchOnMount: 'always',

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
        { status: 'completed', updated_at: now },
      );
      if (profile?.id) {
        queryClient.setQueryData<JobAssignment[]>(
          JOB_KEYS.myJobs(profile.id),
          (old) =>
            (old ?? []).map((a) =>
              a.id === assignmentId
                ? {
                    ...a,
                    completed_at: now,
                    job: a.job
                      ? { ...a.job, status: 'completed' as const, updated_at: now }
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


