import React, { useEffect, useCallback } from 'react';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';

export const useWorkerProfile = () => {
  const { profile, setProfile, signOut } = useAuthStore();
  const {
    workerProfile,
    stats,
    isTogglingAvail,
    loadProfile,
    loadStats,
    setAvailability,
  } = useProfileStore();

  const loadAll = useCallback(async () => {
    if (!profile?.id) return;
    await Promise.all([
      loadProfile(profile.id),
      loadStats(profile.id),
    ]);
  }, [profile?.id, loadProfile, loadStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    profile,
    workerProfile,
    stats,
    isTogglingAvail,
    setAvailability,
    setProfile,
    signOut,
    refreshProfile: loadAll,
  };
};
