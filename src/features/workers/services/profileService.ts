import { supabase } from '@services/supabase';

import type { WorkerProfile, AvailabilityStatus } from '@/types';
import { coerceNumber } from '@utils/formatters';
import { ENV } from '@utils/env';
import { demoDb } from '@/demo/demoDb';
import { getLocalWorkerReviews, computeLocalRatingSummary } from '@utils/localReviews';

const IS_DEMO = ENV.DATA_MODE === 'demo';

const AVAILABILITY_VALUES: AvailabilityStatus[] = ['available', 'busy', 'offline'];

/** Normaliza filas de Supabase (NUMERIC → string, enums faltantes). */
export const normalizeWorkerProfile = (row: WorkerProfile | Record<string, unknown>): WorkerProfile => {
  const raw = row as Record<string, unknown>;
  const status = raw.availability_status;
  const availability_status: AvailabilityStatus = AVAILABILITY_VALUES.includes(
    status as AvailabilityStatus,
  )
    ? (status as AvailabilityStatus)
    : 'offline';

  const ratingRaw = raw.rating_avg;
  const rating_avg =
    ratingRaw == null || ratingRaw === ''
      ? null
      : coerceNumber(ratingRaw, NaN);

  return {
    ...(row as WorkerProfile),
    availability_status,
    rating_avg: Number.isFinite(rating_avg) ? rating_avg : null,
    total_reviews: coerceNumber(raw.total_reviews, 0),
    total_jobs_done: coerceNumber(raw.total_jobs_done, 0),
    skills: Array.isArray(raw.skills) ? (raw.skills as string[]) : [],
  };
};


import {

  getLocalWorkerProfile,

  patchLocalWorkerProfile,

  setLocalAvailability,

} from '@utils/localWorkerProfile';



// ─── Fetch ────────────────────────────────────────────────────────────────────



/** Trae el perfil extendido del trabajador. Crea uno vacío si no existe. */

export const fetchWorkerProfile = async (workerId: string): Promise<WorkerProfile> => {

  if (IS_DEMO) {
    const cached = await getLocalWorkerProfile(workerId);
    const reviews = await getLocalWorkerReviews(workerId);
    const { rating_avg, total_reviews } = computeLocalRatingSummary(reviews);
    const assignments = await demoDb.listWorkerAssignments(workerId);
    const total_jobs_done = assignments.filter((a) => a.job?.status === 'completed').length;

    return {
      worker_id: workerId,
      bio: cached?.bio ?? null,
      skills: cached?.skills ?? [],
      id_document_url: cached?.id_document_url ?? null,
      id_verified: cached?.id_verified ?? false,
      availability_status: cached?.availability_status ?? 'offline',
      last_lat: cached?.last_lat ?? null,
      last_lng: cached?.last_lng ?? null,
      last_location_at: cached?.last_location_at ?? null,
      updated_at: new Date().toISOString(),
      rating_avg,
      total_reviews,
      total_jobs_done,
    };
  }

  try {

    const { data, error } = await supabase

      .from('worker_profiles')

      .select('*')

      .eq('worker_id', workerId)

      .maybeSingle();



    if (!error && data) {
      const profile = normalizeWorkerProfile(data as WorkerProfile);
      await patchLocalWorkerProfile(workerId, profile);
      return profile;
    }

    if (!error && !data) {

      const { data: created, error: createErr } = await supabase

        .from('worker_profiles')

        .upsert({

          worker_id:           workerId,

          bio:                 null,

          skills:              [],

          id_verified:         false,

          rating_avg:          null,

          total_reviews:       0,

          total_jobs_done:     0,

          availability_status: 'offline' as AvailabilityStatus,

        })

        .select()

        .single();



      if (!createErr && created) {
        const profile = normalizeWorkerProfile(created as WorkerProfile);
        await patchLocalWorkerProfile(workerId, profile);
        return profile;
      }

    }

  } catch {

    // continuar con caché local

  }



  const cached = await getLocalWorkerProfile(workerId);

  if (cached) return normalizeWorkerProfile(cached);



  return patchLocalWorkerProfile(workerId, { availability_status: 'offline' });

};



// ─── Availability ─────────────────────────────────────────────────────────────



/**

 * Cambia la disponibilidad del trabajador.

 * Guarda en caché local y sincroniza con Supabase cuando es posible.

 */

export const setAvailabilityStatus = async (

  workerId: string,

  status: AvailabilityStatus,

): Promise<WorkerProfile> => {

  const localFirst = await setLocalAvailability(workerId, status);



  try {

    const { data, error } = await supabase

      .from('worker_profiles')

      .upsert({

        worker_id:           workerId,

        availability_status: status,

        skills:              localFirst.skills ?? [],

        updated_at:          new Date().toISOString(),

      })

      .select()

      .single();



    if (!error && data) {
      const profile = normalizeWorkerProfile(data as WorkerProfile);
      await patchLocalWorkerProfile(workerId, profile);
      return profile;
    }

  } catch {

    // sin sesión Supabase (piloto / teléfono): caché local es suficiente

  }



  return localFirst;

};



// ─── Update profile ───────────────────────────────────────────────────────────



export type WorkerProfileUpdates = Partial<

  Pick<WorkerProfile, 'bio' | 'skills' | 'id_document_url'>

>;



export const updateWorkerProfile = async (

  workerId: string,

  updates: WorkerProfileUpdates,

): Promise<WorkerProfile> => {

  try {

    const { data, error } = await supabase

      .from('worker_profiles')

      .upsert({ worker_id: workerId, ...updates, updated_at: new Date().toISOString() })

      .select()

      .single();



    if (!error && data) {
      const profile = normalizeWorkerProfile(data as WorkerProfile);
      await patchLocalWorkerProfile(workerId, profile);
      return profile;
    }

  } catch {

    // fallback local

  }



  return patchLocalWorkerProfile(workerId, updates);

};



// ─── Realtime subscription ────────────────────────────────────────────────────



/**

 * Suscribirse a cambios del propio worker_profile en tiempo real.

 * Útil para reflejar cambios hechos desde otro dispositivo.

 */

export const subscribeToWorkerProfile = (

  workerId: string,

  onUpdate: (profile: WorkerProfile) => void,

) => {

  const channel = supabase

    .channel(`worker-profile-${workerId}`)

    .on(

      'postgres_changes',

      {

        event:  '*',

        schema: 'public',

        table:  'worker_profiles',

        filter: `worker_id=eq.${workerId}`,

      },

      (payload) => {

        if (payload.new) onUpdate(normalizeWorkerProfile(payload.new as WorkerProfile));

      },

    )

    .subscribe();



  return () => supabase.removeChannel(channel);

};



// ─── Stats ────────────────────────────────────────────────────────────────────



export interface WorkerStats {

  totalEarned:     number;

  completedJobs:   number;

  acceptedJobs:    number;

  pendingPayments: number;

}



type StatsRow = {
  payment_status: string;
  completed_at: string | null;
  selection_status?: string | null;
  job: { worker_payout: number; status?: string } | null;
};

const isCompletedApproved = (r: StatsRow): boolean =>
  r.selection_status !== 'rejected'
  && r.completed_at != null
  && r.job?.status === 'completed';

const rowsToStats = (rows: StatsRow[]): WorkerStats => {
  const completed = rows.filter(isCompletedApproved);
  return {
    totalEarned: completed.reduce((s, r) => s + (r.job?.worker_payout ?? 0), 0),
    completedJobs: completed.length,
    acceptedJobs: rows.filter((r) => r.selection_status === 'approved').length,
    pendingPayments: completed.filter((r) => r.payment_status === 'pending').length,
  };
};

export const fetchWorkerStats = async (workerId: string): Promise<WorkerStats> => {
  if (IS_DEMO) {
    const assignments = await demoDb.listWorkerAssignments(workerId);
    return rowsToStats(assignments.map((a) => ({
      payment_status: a.payment_status,
      completed_at: a.completed_at,
      selection_status: a.selection_status,
      job: a.job ? { worker_payout: a.job.worker_payout ?? 0, status: a.job.status } : null,
    })));
  }

  const { data, error } = await supabase
    .from('job_assignments')
    .select('id, payment_status, completed_at, selection_status, job:jobs(worker_payout, status)')
    .eq('worker_id', workerId)
    .eq('selection_status', 'approved');

  if (error) {
    throw new Error(error.message);
  }

  return rowsToStats((data ?? []) as unknown as StatsRow[]);
};

export interface WorkerTodayStats {
  earningsToday: number;
  jobsToday: number;
}

const isSameLocalDay = (iso: string | null, reference: Date): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === reference.getFullYear()
    && d.getMonth() === reference.getMonth()
    && d.getDate() === reference.getDate()
  );
};

const rowsToTodayStats = (rows: StatsRow[]): WorkerTodayStats => {
  const now = new Date();
  const completedToday = rows.filter((r) => isCompletedApproved(r) && isSameLocalDay(r.completed_at, now));
  return {
    earningsToday: completedToday.reduce((s, r) => s + (r.job?.worker_payout ?? 0), 0),
    jobsToday: completedToday.length,
  };
};

/** Ganancias y trabajos completados HOY (misma consulta que fetchWorkerStats, filtrada por fecha local). */
export const fetchWorkerTodayStats = async (workerId: string): Promise<WorkerTodayStats> => {
  if (IS_DEMO) {
    const assignments = await demoDb.listWorkerAssignments(workerId);
    return rowsToTodayStats(assignments.map((a) => ({
      payment_status: a.payment_status,
      completed_at: a.completed_at,
      selection_status: a.selection_status,
      job: a.job ? { worker_payout: a.job.worker_payout ?? 0, status: a.job.status } : null,
    })));
  }

  const { data, error } = await supabase
    .from('job_assignments')
    .select('id, payment_status, completed_at, selection_status, job:jobs(worker_payout, status)')
    .eq('worker_id', workerId)
    .eq('selection_status', 'approved');

  if (error) {
    throw new Error(error.message);
  }

  return rowsToTodayStats((data ?? []) as unknown as StatsRow[]);
};


