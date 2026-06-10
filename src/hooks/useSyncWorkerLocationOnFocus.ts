import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '@store/authStore';
import { syncWorkerLastLocation } from '@utils/syncWorkerLastLocation';

/** Al enfocar Radar o Agenda: captura GPS y persiste en worker_profiles (throttled). */
export function useSyncWorkerLocationOnFocus(): void {
  const profile = useAuthStore((s) => s.profile);

  useFocusEffect(
    useCallback(() => {
      if (profile?.role !== 'worker' || !profile.id || !profile.is_approved) return;
      void syncWorkerLastLocation(profile.id);
    }, [profile?.id, profile?.role, profile?.is_approved]),
  );
}
