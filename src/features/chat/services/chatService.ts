import { supabase } from '@services/supabase';
import type { JobStatus, ServiceMessage } from '@/types';

export interface JobChatContext {
  jobId: string;
  status: JobStatus;
  serviceTitle: string;
  clientId: string;
  workerId: string | null;
  clientName: string;
  clientAvatar: string | null;
  workerName: string | null;
  workerAvatar: string | null;
}

export async function fetchJobChatContext(jobId: string): Promise<JobChatContext | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      title,
      category,
      status,
      created_by,
      assigned_worker_id,
      creator:profiles!created_by(id, full_name, avatar_url),
      worker:profiles!assigned_worker_id(id, full_name, avatar_url)
    `)
    .eq('id', jobId)
    .maybeSingle();

  if (error || !data) {
    console.warn('[fetchJobChatContext]', error?.message);
    return null;
  }

  const creator = data.creator as { id: string; full_name: string; avatar_url: string | null } | null;
  const worker = data.worker as { id: string; full_name: string; avatar_url: string | null } | null;

  return {
    jobId: data.id,
    status: data.status as JobStatus,
    serviceTitle: data.title?.trim() || 'Servicio CHAMBA',
    clientId: data.created_by,
    workerId: data.assigned_worker_id ?? null,
    clientName: creator?.full_name ?? 'Cliente',
    clientAvatar: creator?.avatar_url ?? null,
    workerName: worker?.full_name ?? null,
    workerAvatar: worker?.avatar_url ?? null,
  };
}

export async function fetchJobMessages(servicioId: string): Promise<ServiceMessage[]> {
  const { data, error } = await supabase
    .from('mensajes')
    .select('id, servicio_id, remitente_id, texto, creado_al')
    .eq('servicio_id', servicioId)
    .order('creado_al', { ascending: true });

  if (error) {
    console.warn('[fetchJobMessages]', error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as ServiceMessage[];
}

export async function sendJobMessage(
  servicioId: string,
  remitenteId: string,
  texto: string,
): Promise<ServiceMessage> {
  const trimmed = texto.trim();
  if (!trimmed) throw new Error('Escribí un mensaje');

  const { data, error } = await supabase
    .from('mensajes')
    .insert({
      servicio_id: servicioId,
      remitente_id: remitenteId,
      texto: trimmed,
    })
    .select('id, servicio_id, remitente_id, texto, creado_al')
    .single();

  if (error) throw new Error(error.message);
  return data as ServiceMessage;
}
