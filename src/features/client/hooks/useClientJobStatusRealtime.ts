import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import { getClientOrderStatusLabel } from '@utils/formatters';
import { syncProfileWithDatabase } from '@utils/profileSync';
import { ensurePhoneAuthSession } from '@utils/phoneAuthSession';
import { JOB_KEYS } from '@features/jobs/hooks/useJobs';
import {
  clientOrdersQueryKey,
  patchClientOrderRowInCache,
} from '@features/client/hooks/useClientOrders';
import type { JobStatus } from '@/types';

export interface ClientStatusToast {
  id: string;
  message: string;
}

type JobRow = {
  id?: string;
  status?: JobStatus;
  operational_phase?: string | null;
  title?: string;
};

const statusKey = (row: JobRow): string =>
  `${row.status ?? ''}:${row.operational_phase ?? ''}`;

const refreshClientOrders = (
  queryClient: ReturnType<typeof useQueryClient>,
  clientId: string,
): void => {
  const key = clientOrdersQueryKey(clientId);
  void queryClient.invalidateQueries({ queryKey: key });
  void queryClient.refetchQueries({ queryKey: key, type: 'all' });
};

/**
 * Realtime (supabase.channel) sobre `jobs` (= solicitudes del cliente).
 * Cuando cambia `status` u `operational_phase`, actualiza caché + banner superior.
 */
export function useClientJobStatusRealtime(): ClientStatusToast | null {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<ClientStatusToast | null>(null);
  const lastStatusRef = useRef<Record<string, string>>({});
  const clientIdRef = useRef<string | null>(null);

  const pushToast = useCallback((jobId: string, message: string) => {
    setToast({ id: `${jobId}-${Date.now()}`, message });
  }, []);

  const notifyJobChange = useCallback(
    (row: JobRow, options?: { skipIfUnchanged?: boolean }) => {
      if (!row?.id || !row.status) return;

      const key = statusKey(row);
      if (options?.skipIfUnchanged && lastStatusRef.current[row.id] === key) return;
      lastStatusRef.current[row.id] = key;

      const clientId = clientIdRef.current;
      if (clientId) {
        patchClientOrderRowInCache(queryClient, clientId, row);
        refreshClientOrders(queryClient, clientId);
      }
      void queryClient.invalidateQueries({ queryKey: JOB_KEYS.detail(row.id) });

      const label = getClientOrderStatusLabel(row.status, row.operational_phase);
      const title = row.title?.trim() ? `"${row.title.trim()}"` : 'Tu solicitud';
      pushToast(row.id, `${title}: ${label}`);
    },
    [pushToast, queryClient],
  );

  useEffect(() => {
    if (!profile?.id || profile.role !== 'client') {
      return undefined;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const synced = await syncProfileWithDatabase(profile);
      if (cancelled) return;

      const clientId = synced.id;
      clientIdRef.current = clientId;

      if (synced.id !== profile.id || synced.is_approved !== profile.is_approved) {
        useAuthStore.getState().setProfile(synced);
      }

      const authSession = await ensurePhoneAuthSession(synced);
      if (cancelled) return;

      if (authSession && !session?.access_token) {
        useAuthStore.getState().setSession(authSession);
      }

      const { data: existingJobs } = await supabase
        .from('jobs')
        .select('id, status, operational_phase, title')
        .eq('created_by', clientId)
        .order('updated_at', { ascending: false })
        .limit(40);

      if (!cancelled && existingJobs) {
        for (const row of existingJobs as JobRow[]) {
          if (row.id) lastStatusRef.current[row.id] = statusKey(row);
        }
      }

      channel = supabase
        .channel(`client-solicitudes-${clientId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'jobs',
            filter: `created_by=eq.${clientId}`,
          },
          (payload) => {
            notifyJobChange(payload.new as JobRow);
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'job_assignments',
          },
          async (payload) => {
            const row = payload.new as {
              job_id?: string;
              selection_status?: string;
            };
            if (row.selection_status !== 'pending' || !row.job_id) return;

            const { data: jobRow } = await supabase
              .from('jobs')
              .select('id, title, created_by, status, operational_phase')
              .eq('id', row.job_id)
              .maybeSingle();

            if (jobRow?.created_by !== clientId) return;

            const title = jobRow.title?.trim()
              ? `"${jobRow.title.trim()}"`
              : 'Tu solicitud';
            pushToast(
              row.job_id,
              `${title}: un técnico postuló. Revisá su perfil en Mis Solicitudes.`,
            );
            refreshClientOrders(queryClient, clientId);
          },
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[ClientRealtime] canal solicitudes:', err?.message ?? status);
          }
          if (status === 'TIMED_OUT') {
            console.warn('[ClientRealtime] canal solicitudes: timeout');
          }
        });
    };

    void setup();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [
    profile?.id,
    profile?.role,
    profile?.phone,
    session?.access_token,
    notifyJobChange,
    pushToast,
    queryClient,
  ]);

  return toast;
}
