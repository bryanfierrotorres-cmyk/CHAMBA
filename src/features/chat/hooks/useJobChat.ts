import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import { ensurePhoneAuthSession } from '@utils/phoneAuthSession';
import {
  fetchJobChatContext,
  fetchJobMessages,
  sendJobMessage,
  type JobChatContext,
} from '../services/chatService';
import { isJobChatWritable } from '../utils/chatHelpers';
import type { JobStatus, ServiceMessage } from '@/types';

export const jobChatMessagesKey = (jobId: string) => ['chat', 'messages', jobId] as const;

export function useJobChat(jobId: string) {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  const messagesQuery = useQuery({
    queryKey: jobChatMessagesKey(jobId),
    queryFn: () => fetchJobMessages(jobId),
    enabled: !!jobId && !!profile?.id && !!context,
    staleTime: 5_000,
  });

  const appendMessage = useCallback(
    (msg: ServiceMessage) => {
      queryClient.setQueryData<ServiceMessage[]>(jobChatMessagesKey(jobId), (old = []) => {
        if (old.some((m) => m.id === msg.id)) return old;
        return [...old, msg].sort(
          (a, b) => new Date(a.creado_al).getTime() - new Date(b.creado_al).getTime(),
        );
      });
    },
    [jobId, queryClient],
  );

  useEffect(() => {
    if (!profile?.id || !jobId || !context) return undefined;

    let cancelled = false;

    void (async () => {
      await ensurePhoneAuthSession(profile);

      if (cancelled) return;

      const channel = supabase
        .channel(`job-chat-${jobId}`)
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
        .subscribe();

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [appendMessage, context, jobId, profile]);

  const effectiveStatus = jobStatus ?? context?.status ?? null;
  const readOnly = !isJobChatWritable(effectiveStatus);

  const counterpart = useMemo(() => {
    if (!context || !profile) return null;
    const isClient = profile.id === context.clientId;
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
        await ensurePhoneAuthSession(profile);
        const msg = await sendJobMessage(jobId, profile.id, text);
        appendMessage(msg);
      } catch (err: unknown) {
        setSendError(err instanceof Error ? err.message : 'No se pudo enviar');
      } finally {
        setIsSending(false);
      }
    },
    [appendMessage, jobId, profile, readOnly],
  );

  return {
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
