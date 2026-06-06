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

const isMissingRpc = (err: { code?: string; message?: string } | null): boolean =>
  !!err && (
    err.code === 'PGRST202'
    || err.message?.includes('Could not find the function')
    || err.message?.includes('send_job_chat_message')
    || err.message?.includes('get_job_chat_messages')
  );

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

async function fetchJobMessagesDirect(servicioId: string): Promise<ServiceMessage[]> {
  const { data, error } = await supabase
    .from('mensajes')
    .select('id, servicio_id, remitente_id, texto, creado_al')
    .eq('servicio_id', servicioId)
    .order('creado_al', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceMessage[];
}

export async function fetchJobMessages(
  servicioId: string,
  callerId?: string,
): Promise<ServiceMessage[]> {
  if (callerId) {
    const { data, error } = await supabase.rpc('get_job_chat_messages', {
      p_servicio_id: servicioId,
      p_caller_id: callerId,
    });

    if (!error && data) {
      const body = data as { success?: boolean; error?: string; messages?: ServiceMessage[] };
      if (body.success && Array.isArray(body.messages)) {
        return body.messages;
      }
      if (!body.success) {
        throw new Error(body.error ?? 'No se pudieron cargar los mensajes');
      }
    }

    if (isMissingRpc(error)) {
      console.warn('[fetchJobMessages] RPC ausente, intento directo');
      return fetchJobMessagesDirect(servicioId);
    }

    throw new Error(error?.message ?? 'No se pudieron cargar los mensajes');
  }

  return fetchJobMessagesDirect(servicioId);
}

async function sendJobMessageDirect(
  servicioId: string,
  remitenteId: string,
  texto: string,
): Promise<ServiceMessage> {
  const { data, error } = await supabase
    .from('mensajes')
    .insert({
      servicio_id: servicioId,
      remitente_id: remitenteId,
      texto,
    })
    .select('id, servicio_id, remitente_id, texto, creado_al')
    .single();

  if (error) throw new Error(error.message);
  return data as ServiceMessage;
}

export async function sendJobMessage(
  servicioId: string,
  remitenteId: string,
  texto: string,
): Promise<ServiceMessage> {
  const trimmed = texto.trim();
  if (!trimmed) throw new Error('Escribí un mensaje');

  const { data, error } = await supabase.rpc('send_job_chat_message', {
    p_servicio_id: servicioId,
    p_remitente_id: remitenteId,
    p_texto: trimmed,
  });

  if (!error && data) {
    const body = data as {
      success?: boolean;
      error?: string;
      message?: ServiceMessage;
    };
    if (body.success && body.message) {
      return body.message;
    }
    if (!body.success) {
      throw new Error(body.error ?? 'No se pudo enviar el mensaje');
    }
  }

  if (isMissingRpc(error)) {
    throw new Error(
      'Chat no configurado en el servidor. Ejecutá npm run db:sync-chat (migración 024) o pegá el SQL en Supabase.',
    );
  }

  if (error?.message?.includes('row-level security')) {
    throw new Error(
      'No se pudo enviar: falta aplicar la migración 024 en Supabase (npm run db:sync-chat).',
    );
  }

  throw new Error(error?.message ?? 'No se pudo enviar el mensaje');
}
