import { supabase } from '@services/supabase';
import { syncProfileWithDatabase } from '@utils/profileSync';
import type { JobStatus, ServiceMessage, UserProfile } from '@/types';

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

const isAuthRequired = (body?: { error?: string; code?: string } | null): boolean =>
  body?.code === 'auth_required'
  || !!body?.error?.includes('Sesión requerida');

const ensureActorSession = async (profile: UserProfile): Promise<string> => {
  const synced = await syncProfileWithDatabase(profile);
  if (!synced.id) {
    throw new Error(
      'Sesión requerida para el chat. Cerrá la app y volvé a entrar con tu celular.',
    );
  }
  return synced.id;
};

const isMissingRpc = (err: { code?: string; message?: string } | null): boolean =>
  Boolean(
    err && (
      err.code === 'PGRST202'
      || err.message?.includes('Could not find the function')
      || err.message?.includes('send_job_chat_message')
      || err.message?.includes('get_job_chat_messages')
    ),
  );

type ProfileJoin = { id: string; full_name: string; avatar_url: string | null };

const unwrapProfileJoin = (
  value: ProfileJoin | ProfileJoin[] | null | undefined,
): ProfileJoin | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

export async function fetchJobChatContext(jobId: string, callerId?: string): Promise<JobChatContext | null> {
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
    if (callerId) {
      // Fallback a RPC existentes porque RLS bloquea lectura directa local (DEV_MODE)
      // Buscamos si el caller es técnico asignado a este servicio
      const { data: assignments } = await supabase.rpc('get_worker_assignments', { p_worker_id: callerId });
      if (assignments && Array.isArray(assignments)) {
        const match = assignments.find((a: any) => a.job_id === jobId);
        if (match && match.job) {
          const j = match.job;
          return {
            jobId: j.id,
            status: j.status as JobStatus,
            serviceTitle: j.title?.trim() || 'Servicio CHAMBA',
            clientId: j.created_by,
            workerId: j.assigned_worker_id ?? null,
            clientName: 'Cliente',
            clientAvatar: null,
            workerName: 'Técnico',
            workerAvatar: null,
          };
        }
      }
      
      // Si el caller es el cliente creador
      const { data: clientJobs } = await supabase.rpc('get_client_jobs', { p_client_id: callerId, p_status: 'all' });
      if (clientJobs && Array.isArray(clientJobs)) {
        const match = clientJobs.find((j: any) => j.id === jobId);
        if (match) {
          return {
            jobId: match.id,
            status: match.status as JobStatus,
            serviceTitle: match.title?.trim() || 'Servicio CHAMBA',
            clientId: match.created_by,
            workerId: match.assigned_worker_id ?? null,
            clientName: 'Cliente',
            clientAvatar: null,
            workerName: 'Técnico',
            workerAvatar: null,
          };
        }
      }
    }
    console.warn('[fetchJobChatContext]', error?.message);
    return null;
  }

  const creator = unwrapProfileJoin(
    data.creator as ProfileJoin | ProfileJoin[] | null | undefined,
  );
  const worker = unwrapProfileJoin(
    data.worker as ProfileJoin | ProfileJoin[] | null | undefined,
  );

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
  profile?: UserProfile | null,
): Promise<ServiceMessage[]> {
  const loadViaRpc = async (actorId: string): Promise<ServiceMessage[]> => {
    const { data, error } = await supabase.rpc('get_job_chat_messages', {
      p_servicio_id: servicioId,
      p_caller_id: actorId,
    });

    if (!error && data) {
      const body = data as { success?: boolean; error?: string; messages?: ServiceMessage[]; code?: string };
      if (body.success && Array.isArray(body.messages)) {
        return body.messages;
      }
      if (!body.success) {
        if (isAuthRequired(body)) {
          throw new Error('auth_required');
        }
        throw new Error(body.error ?? 'No se pudieron cargar los mensajes');
      }
    }

    if (isMissingRpc(error)) {
      console.warn('[fetchJobMessages] RPC ausente, intento directo');
      return fetchJobMessagesDirect(servicioId);
    }

    throw new Error(error?.message ?? 'No se pudieron cargar los mensajes');
  };

  if (callerId) {
    try {
      return await loadViaRpc(callerId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'auth_required' && profile) {
        const actorId = await ensureActorSession(profile);
        return loadViaRpc(actorId);
      }
      if (msg === 'auth_required') {
        throw new Error(
          'Sesión requerida para el chat. Cerrá la app y volvé a entrar con tu celular.',
        );
      }
      throw err;
    }
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
  profile?: UserProfile | null,
): Promise<ServiceMessage> {
  const trimmed = texto.trim();
  if (!trimmed) throw new Error('Escribí un mensaje');

  const sendViaRpc = async (actorId: string): Promise<ServiceMessage> => {
    const { data, error } = await supabase.rpc('send_job_chat_message', {
      p_servicio_id: servicioId,
      p_remitente_id: actorId,
      p_texto: trimmed,
    });

    if (!error && data) {
      const body = data as {
        success?: boolean;
        error?: string;
        message?: ServiceMessage;
        code?: string;
      };
      if (body.success && body.message) {
        return body.message;
      }
      if (!body.success) {
        if (isAuthRequired(body)) {
          throw new Error('auth_required');
        }
        if (body.code === 'rls_denied' || body.error?.includes('No podés enviar')) {
          throw new Error(body.error ?? 'No podés enviar mensajes en este servicio');
        }
        throw new Error(body.error ?? 'No se pudo enviar el mensaje');
      }
    }

    if (isMissingRpc(error)) {
      throw new Error(
        'Chat no configurado en el servidor. Ejecutá npm run db:apply-chat-phone-fix en Supabase.',
      );
    }

    if (error?.message?.includes('row-level security')) {
      throw new Error(
        'No se pudo enviar: aplicá npm run db:apply-chat-phone-fix y volvé a iniciar sesión.',
      );
    }

    throw new Error(error?.message ?? 'No se pudo enviar el mensaje');
  };

  try {
    return await sendViaRpc(remitenteId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'auth_required' && profile) {
      const actorId = await ensureActorSession(profile);
      return sendViaRpc(actorId);
    }
    if (msg === 'auth_required') {
      throw new Error(
        'No se pudo enviar: tu sesión expiró. Salí y volvé a entrar a CHAMBA para chatear.',
      );
    }
    throw err;
  }
}
