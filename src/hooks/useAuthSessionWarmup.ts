import { useEffect } from 'react';
import { useAuthStore } from '@store/authStore';
import { ensurePhoneAuthSession } from '@utils/phoneAuthSession';

/** Abre sesión Supabase en segundo plano para que RLS no bloquee paneles. */
export function useAuthSessionWarmup(): void {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!profile?.id || session?.access_token) return;
    void ensurePhoneAuthSession(profile).then((s) => {
      if (s) {
        useAuthStore.getState().setSession(s);
        useAuthStore.getState().setPhoneAuth(false);
      }
    });
  }, [profile?.id, session?.access_token]);
}
