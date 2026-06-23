import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import {
  syncProfileWithDatabase,
} from '@utils/profileSync';
import { fetchJobChatContext, fetchJobMessages, sendJobMessage, type JobChatContext } from '../services/chatService';
import { isJobChatWritable } from '../utils/chatHelpers';
import type { JobStatus, ServiceMessage, TypingBroadcastPayload } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [counterpartTyping, setCounterpartTyping] = useState(false);

  // Throttling ref para enviar señal de "typing"
  const typingRef = useRef<{ isThrottled: boolean; timeout: NodeJS.Timeout | null }>({
    isThrottled: false,
    timeout: null,
  });

  const contextQuery = useQuery({
    queryKey: ['chat', 'context', jobId],
    queryFn: () => fetchJobChatContext(jobId, actorId ?? profile?.id),
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

    // 1. Lectura Caché Local
    const cacheKey = `@chat_cache_${jobId}`;
    let localMessages: ServiceMessage[] = [];
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) localMessages = JSON.parse(cached);
    } catch (e) {
      console.warn('Error reading chat cache:', e);
    }

    if (localMessages.length > 0) {
      // Setear instantáneamente el caché local
      queryClient.setQueryData<ServiceMessage[]>(jobChatMessagesKey(jobId), localMessages);
    }

    // 2. Fetch remoto (idealmente diferencial, pero mantendremos fetch completo y merge por ahora para simplicidad)
    const remoteMessages = await fetchJobMessages(jobId, synced.id, synced);
    
    // 3. Unificar asegurando que los mensajes remotos pisen a los temporales u optimistas locales
    const merged = [...remoteMessages];
    
    // 4. Guardar los últimos 50 en caché
    const last50 = merged.slice(-50);
    AsyncStorage.setItem(cacheKey, JSON.stringify(last50)).catch(e => console.warn('Cache write err:', e));

    return merged;
  }, [jobId, profile, queryClient]);

  const messagesQuery = useQuery({
    queryKey: jobChatMessagesKey(jobId),
    queryFn: loadMessages,
    enabled: !!jobId && !!profile?.id && !!context,
    staleTime: 30_000,
    refetchInterval: CHAT_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const appendMessage = useCallback(
    (msg: ServiceMessage, isOptimistic = false) => {
      queryClient.setQueryData<ServiceMessage[]>(jobChatMessagesKey(jobId), (old: ServiceMessage[] | undefined) => {
        const current = old ?? [];
        
        // Si no es optimista y ya existe un optimista con el mismo texto reciente, lo reemplazamos
        // Para simplificar, si msg.id ya existe lo pisamos (por si un optimista se actualiza con el ID final)
        const existsIndex = current.findIndex(m => m.id === msg.id);
        
        let newMessages;
        if (existsIndex >= 0) {
          newMessages = [...current];
          newMessages[existsIndex] = { ...msg, isOptimistic };
        } else {
          newMessages = [...current, { ...msg, isOptimistic }];
        }

        const sorted = newMessages.sort(
          (a, b) => new Date(a.creado_al).getTime() - new Date(b.creado_al).getTime(),
        );

        // Guardar silenciosamente en caché
        AsyncStorage.setItem(`@chat_cache_${jobId}`, JSON.stringify(sorted.slice(-50))).catch(() => {});
        return sorted;
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
            // Solo añadir si no fui yo (evito duplicar mi propio mensaje optimista)
            const newMsg = payload.new as ServiceMessage;
            if (newMsg.remitente_id !== synced.id) {
              appendMessage(newMsg);
            }
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
        .on(
          'broadcast',
          { event: 'typing' },
          (payload: { payload: TypingBroadcastPayload['payload'] }) => {
            if (payload.payload.userId !== synced.id) {
              setCounterpartTyping(payload.payload.isTyping);
            }
          }
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
  ]);

  const sendTypingSignal = useCallback(async () => {
    if (!profile?.id || !jobId) return;

    if (typingRef.current.timeout) clearTimeout(typingRef.current.timeout);

    // Stop typing fallback (after 3000ms of inactivity)
    typingRef.current.timeout = setTimeout(() => {
      typingRef.current.isThrottled = false;
      void supabase.channel(`job-chat-${jobId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, isTyping: false },
      });
    }, 3000);

    if (typingRef.current.isThrottled) return;

    typingRef.current.isThrottled = true;
    void supabase.channel(`job-chat-${jobId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: profile.id, isTyping: true },
    });
    
    // Re-allow signaling after 2500ms
    setTimeout(() => {
      typingRef.current.isThrottled = false;
    }, 2500);
  }, [jobId, profile?.id]);

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

      const synced = await syncProfileWithDatabase(profile);
      setActorId(synced.id);

      const tempId = `temp_${Date.now()}`;
      const optimisticMsg: ServiceMessage = {
        id: tempId,
        servicio_id: jobId,
        remitente_id: synced.id,
        texto: text,
        creado_al: new Date().toISOString(),
      };

      // Inserción optimista inmediata
      appendMessage(optimisticMsg, true);

      // Stop typing
      if (typingRef.current.timeout) clearTimeout(typingRef.current.timeout);
      typingRef.current.isThrottled = false;
      void supabase.channel(`job-chat-${jobId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, isTyping: false },
      });

      try {
        const finalMsg = await sendJobMessage(jobId, synced.id, text, synced);
        
        // Reemplazar mensaje optimista por el real (eliminamos el temporal y añadimos el final)
        queryClient.setQueryData<ServiceMessage[]>(jobChatMessagesKey(jobId), (old: ServiceMessage[] | undefined) => {
          const current = old ?? [];
          const filtered = current.filter((m: ServiceMessage) => m.id !== tempId);
          return [...filtered, finalMsg].sort(
            (a, b) => new Date(a.creado_al).getTime() - new Date(b.creado_al).getTime(),
          );
        });

      } catch (err: unknown) {
        // En caso de error, remover mensaje optimista
        queryClient.setQueryData<ServiceMessage[]>(jobChatMessagesKey(jobId), (old: ServiceMessage[] | undefined) => {
          return (old ?? []).filter((m: ServiceMessage) => m.id !== tempId);
        });

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
    [appendMessage, jobId, profile, readOnly, queryClient],
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
    sendTypingSignal,
    counterpartTyping,
    sendError,
    isSending,
  };
}
