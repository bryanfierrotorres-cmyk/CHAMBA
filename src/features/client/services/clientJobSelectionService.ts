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

export type ClientApproveWorkerResult = {
  jobId: string;
  workerId: string;
  jobStatus: string;
  selectionStatus: string;
  operationalPhase: string;
};

export const clientApproveWorkerApplication = async (
  jobId: string,
  clientId: string,
  workerId: string,
): Promise<ClientApproveWorkerResult> => {
  const { data, error } = await supabase.rpc('client_approve_worker_application', {
    p_job_id: jobId,
    p_client_id: clientId,
    p_worker_id: workerId,
  });

  if (error) throw new Error(error.message);
  const body = data as {
    success?: boolean;
    error?: string;
    job_status?: string;
    selection_status?: string;
    operational_phase?: string;
  } | null;
  if (!body?.success) throw new Error(body?.error ?? 'No se pudo aprobar al técnico');

  return {
    jobId,
    workerId,
    jobStatus: body.job_status ?? 'taken',
    selectionStatus: body.selection_status ?? 'approved',
    operationalPhase: body.operational_phase ?? 'accepted',
  };
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
