import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import { getClientOrderStatusLabel } from '@utils/formatters';
import type { JobStatus } from '@/types';

export interface ClientStatusToast {
  id: string;
  message: string;
}

/**
 * Escucha cambios en `jobs` del cliente y expone mensajes para banner superior.
 */
export function useClientJobStatusRealtime(): ClientStatusToast | null {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const [toast, setToast] = useState<ClientStatusToast | null>(null);
  const lastStatusRef = useRef<Record<string, string>>({});

  const pushToast = useCallback((jobId: string, message: string) => {
    setToast({ id: `${jobId}-${Date.now()}`, message });
  }, []);

  useEffect(() => {
    if (!profile?.id || profile.role !== 'client' || !session?.access_token) {
      return undefined;
    }

    const clientId = profile.id;

    const channel = supabase
      .channel(`client-jobs-status-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `created_by=eq.${clientId}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            status?: JobStatus;
            operational_phase?: string | null;
            title?: string;
          };
          if (!row?.id || !row.status) return;

          const statusKey = `${row.status}:${row.operational_phase ?? ''}`;
          if (lastStatusRef.current[row.id] === statusKey) return;
          lastStatusRef.current[row.id] = statusKey;

          const label = getClientOrderStatusLabel(row.status, row.operational_phase);
          const title = row.title?.trim() ? `"${row.title.trim()}"` : 'Tu solicitud';
          pushToast(row.id, `${title}: ${label}`);
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
            .select('id, title, created_by')
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
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role, session?.access_token, pushToast]);

  return toast;
}
