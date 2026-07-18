import { supabase } from '@services/supabase';

/**
 * Solo lectura. La tabla `analytics_events` ya restringe SELECT a admin vía RLS
 * (migración 064_analytics_events.sql) — esto es una capa adicional, no la única.
 */
export interface CrashEvent {
  id: string;
  created_at: string;
  metadata: { error?: string; stack?: string } | null;
}

/**
 * Últimos crashes registrados por AppErrorBoundary.
 *
 * NOTA: AppErrorBoundary.tsx inserta con la columna `event_type`, pero la tabla
 * real (064_analytics_events.sql) define `event_name` — un mismatch de columna
 * que hoy hace que ese INSERT falle en silencio (fire-and-forget sin .catch).
 * Esta función consulta la columna REAL (`event_name`); mientras ese bug no se
 * corrija (requiere tocar AppErrorBoundary.tsx, archivo compartido con cliente/
 * técnico — fuera de alcance sin aprobación explícita), es esperable que la
 * lista aparezca vacía incluso si hubo crashes reales.
 */
export const fetchRecentCrashes = async (limit = 30): Promise<CrashEvent[]> => {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('id, created_at, metadata')
    .eq('event_name', 'app_crash')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CrashEvent[];
};
