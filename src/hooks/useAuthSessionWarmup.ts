import { useEffect } from 'react';
import { useAuthStore } from '@store/authStore';
import { syncProfileWithDatabase } from '@utils/profileSync';

/** Sincroniza perfil con BD para que RLS y el radar no queden vacíos. */
export function useAuthSessionWarmup(): void {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!profile?.id) return;

    void (async () => {
      const synced = await syncProfileWithDatabase(profile);
      const changed =
        synced.id !== profile.id
        || synced.is_approved !== profile.is_approved
        || synced.worker_status !== profile.worker_status
        || synced.cedula_url !== profile.cedula_url
        || synced.record_policia_url !== profile.record_policia_url;
      if (changed) {
        useAuthStore.getState().setProfile(synced);
      }
    })();
  }, [profile?.id, profile?.phone, session?.access_token]);
}