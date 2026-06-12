import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import {
  syncProfileWithDatabase,
} from '@utils/profileSync';
import {
  fetchJobChatContext,
  fetchJobMessages,
  sendJobMessage,
  type JobChatContext,
} from '../services/chatService';
import { isJobChatWritable } from '../utils/chatHelpers';
import type { JobStatus, ServiceMessage } from '@/types';

export const jobChatMessagesKey = (jobId: string) => ['chat', 'messages', jobId] as const;

/** Respaldo si Realtime no entrega (RLS / sesión / web). */
const CHAT_POLL_MS = 4_000;

export function useJobChat(jobId: string) {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [actorId, setActorId] = useState<string | null>(profile?.id ?? null);

  const contextQuery = useQuery({
    queryKey: ['chat', 'context', jobId],
    queryFn: () => fetchJobChatContext(jobId),
    enabled: !!jobId && !!profile?.id,
    staleTime: 30_000,
  });

  const context = contextQuery.data ?? null;

  useEffect(() => {
    if (context?.status) setJobStatus(context.status);
  }, [context?.status]);

  const loadMessages = useCallback(async () => {
    if (!profile?.id) return [];
    const synced = await syncProfileWithDatabase(profile);
    setActorId(synced.id);

    return fetchJobMessages(jobId, synced.id, synced);
  }, [jobId, profile]);

  const messagesQuery = useQuery({
    queryKey: jobChatMessagesKey(jobId),
    queryFn: loadMessages,
    enabled: !!jobId && !!profile?.id && !!context,
    staleTime: 2_000,
    refetchInterval: CHAT_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const appendMessage = useCallback(
    (msg: ServiceMessage) => {
      queryClient.setQueryData<ServiceMessage[]>(jobChatMessagesKey(jobId), (old: ServiceMessage[] | undefined) => {
        const current = old ?? [];
        if (current.some((m) => m.id === msg.id)) return current;
        return [...current, msg].sort(
          (a, b) => new Date(a.creado_al).getTime() - new Date(b.creado_al).getTime(),
        );
      });
    },
    [jobId, queryClient],
  );

  useEffect(() => {
    if (!profile?.id || !jobId || !context) return undefined;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const synced = await syncProfileWithDatabase(profile);
      if (cancelled) return;

      setActorId(synced.id);

      channel = supabase
        .channel(`job-chat-${jobId}-${synced.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mensajes',
            filter: `servicio_id=eq.${jobId}`,
          },
          (payload) => {
            appendMessage(payload.new as ServiceMessage);
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const next = payload.new as { status?: JobStatus };
            if (next.status) setJobStatus(next.status);
          },
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[JobChat] realtime:', err?.message ?? status);
          }
          if (status === 'TIMED_OUT') {
            console.warn('[JobChat] realtime: timeout');
          }
        });
    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [
    appendMessage,
    context,
    jobId,
    profile?.id,
    profile?.phone,
    session?.access_token,
  ]);

  const effectiveStatus = jobStatus ?? context?.status ?? null;
  const readOnly = !isJobChatWritable(effectiveStatus);

  const counterpart = useMemo(() => {
    if (!context || !profile) return null;
    const isClient =
      profile.id === context.clientId
      || (profile.role === 'client' && profile.id !== context.workerId);
    return {
      id: isClient ? context.workerId : context.clientId,
      name: isClient ? context.workerName ?? 'Técnico' : context.clientName,
      avatar: isClient ? context.workerAvatar : context.clientAvatar,
    };
  }, [context, profile]);

  const send = useCallback(
    async (text: string) => {
      if (!profile?.id || readOnly) return;
      setSendError(null);
      setIsSending(true);
      try {
        const synced = await syncProfileWithDatabase(profile);
        setActorId(synced.id);
        const msg = await sendJobMessage(jobId, synced.id, text, synced);
        appendMessage(msg);
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : 'No se pudo enviar';
        const friendly = raw.includes('row-level security')
          ? 'No se pudo enviar. Ejecutá npm run db:sync-chat y volvé a iniciar sesión.'
          : raw.includes('No podés enviar mensajes')
            ? raw
            : raw;
        setSendError(friendly);
      } finally {
        setIsSending(false);
      }
    },
    [appendMessage, jobId, profile, readOnly],
  );

  return {
    actorId: actorId ?? profile?.id ?? null,
    context: context as JobChatContext | null,
    messages: messagesQuery.data ?? [],
    isLoading: contextQuery.isLoading || messagesQuery.isLoading,
    isError: contextQuery.isError || messagesQuery.isError,
    refetch: () => {
      void contextQuery.refetch();
      void messagesQuery.refetch();
    },
    readOnly,
    effectiveStatus,
    counterpart,
    send,
    sendError,
    isSending,
  };
}
