import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@services/supabase';
import type { JobWorkerApplication } from '@/types';

const parseApplicationsBody = (
  data: unknown,
): { applications: JobWorkerApplication[]; jobStatus?: string } => {
  const body = data as {
    success?: boolean;
    error?: string;
    applications?: JobWorkerApplication[];
    job_status?: string;
  } | null;

  if (!body?.success) {
    throw new Error(body?.error ?? 'No se pudieron cargar las postulaciones');
  }

  return {
    applications: body.applications ?? [],
    jobStatus: body.job_status,
  };
};

export const fetchJobWorkerApplications = async (
  jobId: string,
  clientId: string,
): Promise<JobWorkerApplication[]> => {
  const { data, error } = await supabase.rpc('get_job_worker_applications', {
    p_job_id: jobId,
    p_client_id: clientId,
  });

  if (error) throw new Error(error.message);
  return parseApplicationsBody(data).applications;
};

export const clientApproveWorkerApplication = async (
  jobId: string,
  clientId: string,
  workerId: string,
): Promise<void> => {
  const { data, error } = await supabase.rpc('client_approve_worker_application', {
    p_job_id: jobId,
    p_client_id: clientId,
    p_worker_id: workerId,
  });

  if (error) throw new Error(error.message);
  const body = data as { success?: boolean; error?: string } | null;
  if (!body?.success) throw new Error(body?.error ?? 'No se pudo aprobar al técnico');
};

export const clientRejectWorkerApplication = async (
  jobId: string,
  clientId: string,
  workerId: string,
): Promise<void> => {
  const { data, error } = await supabase.rpc('client_reject_worker_application', {
    p_job_id: jobId,
    p_client_id: clientId,
    p_worker_id: workerId,
  });

  if (error) throw new Error(error.message);
  const body = data as { success?: boolean; error?: string } | null;
  if (!body?.success) throw new Error(body?.error ?? 'No se pudo rechazar la postulación');
};

/** Realtime: nueva postulación o cambio de estado en job_assignments. */
export const subscribeToJobWorkerApplications = (
  jobId: string,
  onChange: () => void,
): (() => void) => {
  const channel: RealtimeChannel = supabase
    .channel(`job-applications-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'job_assignments',
        filter: `job_id=eq.${jobId}`,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'job_assignments',
        filter: `job_id=eq.${jobId}`,
      },
      () => onChange(),
    )
    .subscribe((status, err) => {
      if (__DEV__ && (status === 'CHANNEL_ERROR' || err)) {
        console.warn('[JobApplicationsRealtime]', jobId, err?.message ?? status);
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
};
