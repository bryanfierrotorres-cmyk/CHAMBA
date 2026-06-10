import { useEffect } from 'react';
import { useAuthStore } from '@store/authStore';
import { syncProfileWithDatabase } from '@utils/profileSync';
import { clearMismatchedAuthSession, ensurePhoneAuthSession } from '@utils/phoneAuthSession';

/** Sincroniza perfil + sesión Auth para que RLS y el radar no queden vacíos. */
export function useAuthSessionWarmup(): void {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!profile?.id) return;

    void (async () => {
      const synced = await syncProfileWithDatabase(profile);
      if (synced.id !== profile.id || synced.is_approved !== profile.is_approved) {
        useAuthStore.getState().setProfile(synced);
      }
      await clearMismatchedAuthSession(synced);

      if (session?.access_token) return;

      const authSession = await ensurePhoneAuthSession(synced);
      if (authSession) {
        useAuthStore.getState().setSession(authSession);
        useAuthStore.getState().setPhoneAuth(false);
      }
    })();
  }, [profile?.id, profile?.phone, session?.access_token]);
}
