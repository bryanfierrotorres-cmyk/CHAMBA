import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@store/authStore';
import { subscribeToWorkerProfile } from '../services/profileService';
import { useProfileStore } from '@store/profileStore';

export const useLiveWorkerData = () => {
  const { profile } = useAuthStore();
  const { setWorkerProfile } = useProfileStore();
  const [isOnline, setIsOnline] = useState(false); // Telemetry extension point

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeToWorkerProfile(profile.id, setWorkerProfile);
    
    // Future telemetry subscriptions (e.g. GPS, chat presence) go here
    setIsOnline(true);
    
    return () => {
      void unsub();
      setIsOnline(false);
    };
  }, [profile?.id, setWorkerProfile]);

  return {
    isOnline,
    // Add real-time telemetry events here
  };
};
