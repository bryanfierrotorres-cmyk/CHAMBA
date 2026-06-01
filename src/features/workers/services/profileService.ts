import { supabase } from '@services/supabase';

import type { WorkerProfile, AvailabilityStatus } from '@/types';

import { getLocalAssignments } from '@utils/localAssignments';

import {

  getLocalWorkerProfile,

  patchLocalWorkerProfile,

  setLocalAvailability,

} from '@utils/localWorkerProfile';



// ─── Fetch ────────────────────────────────────────────────────────────────────



/** Trae el perfil extendido del trabajador. Crea uno vacío si no existe. */

export const fetchWorkerProfile = async (workerId: string): Promise<WorkerProfile> => {

  try {

    const { data, error } = await supabase

      .from('worker_profiles')

      .select('*')

      .eq('worker_id', workerId)

      .maybeSingle();



    if (!error && data) {

      await patchLocalWorkerProfile(workerId, data as WorkerProfile);

      return data as WorkerProfile;

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

        await patchLocalWorkerProfile(workerId, created as WorkerProfile);

        return created as WorkerProfile;

      }

    }

  } catch {

    // continuar con caché local

  }



  const cached = await getLocalWorkerProfile(workerId);

  if (cached) return cached;



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

      await patchLocalWorkerProfile(workerId, data as WorkerProfile);

      return data as WorkerProfile;

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

      await patchLocalWorkerProfile(workerId, data as WorkerProfile);

      return data as WorkerProfile;

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

        if (payload.new) onUpdate(payload.new as WorkerProfile);

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

  job: { worker_payout: number } | null;

};



const rowsToStats = (rows: StatsRow[]): WorkerStats => ({

  totalEarned: rows

    .filter((r) => r.payment_status === 'paid')

    .reduce((s, r) => s + (r.job?.worker_payout ?? 0), 0),

  completedJobs: rows.filter((r) => r.completed_at !== null).length,

  acceptedJobs:  rows.length,

  pendingPayments: rows.filter((r) => r.payment_status === 'pending').length,

});



export const fetchWorkerStats = async (workerId: string): Promise<WorkerStats> => {

  const byKey = new Map<string, StatsRow>();



  try {

    const { data, error } = await supabase

      .from('job_assignments')

      .select('id, payment_status, completed_at, job:jobs(worker_payout)')

      .eq('worker_id', workerId);



    if (!error && data) {

      for (const row of (data ?? []) as unknown as Array<StatsRow & { id: string }>) {

        byKey.set(row.id, row);

      }

    }

  } catch {

    // continuar con caché local

  }



  const local = await getLocalAssignments(workerId);

  for (const a of local) {

    if (byKey.has(a.id)) continue;

    byKey.set(a.id, {

      payment_status: a.payment_status,

      completed_at:   a.completed_at,

      job: a.job ? { worker_payout: a.job.worker_payout ?? 0 } : null,

    });

  }



  return rowsToStats(Array.from(byKey.values()));

};


