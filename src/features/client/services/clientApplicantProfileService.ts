import { supabase } from '@services/supabase';

export interface ApplicantProfileExtras {
  bio: string | null;
}

/**
 * Lectura best-effort de bio del técnico postulante (solo UI).
 * Si RLS bloquea el SELECT, devuelve bio null sin lanzar error.
 */
export const fetchApplicantProfileExtras = async (
  workerId: string,
): Promise<ApplicantProfileExtras> => {
  try {
    const { data, error } = await supabase
      .from('worker_profiles')
      .select('bio')
      .eq('worker_id', workerId)
      .maybeSingle();

    if (error || !data) {
      return { bio: null };
    }

    const bio = typeof data.bio === 'string' ? data.bio.trim() : null;
    return { bio: bio || null };
  } catch {
    return { bio: null };
  }
};
