import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { loadWorkerSearchRadiusKm, DEFAULT_RADIUS_KM } from '@utils/workerSearchRadius';
import { fetchRadarInboxData, type RadarInboxData } from '@features/jobs/services/radarInboxService';

export interface TecnicoInicioResult {
  data: RadarInboxData | undefined;
  isLoading: boolean;
  radiusKm: number;
  ratingAvg: number | null;
  fullName: string | null;
  avatarUrl: string | null | undefined;
  isOnline: boolean;
}

export function useTecnicoInicio(): TecnicoInicioResult {
  const profile = useAuthStore((s) => s.profile);
  const workerProfile = useProfileStore((s) => s.workerProfile);
  const loadProfile = useProfileStore((s) => s.loadProfile);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);

  useEffect(() => {
    if (!profile?.id) return;
    void loadWorkerSearchRadiusKm(profile.id).then(setRadiusKm);
    if (!workerProfile) void loadProfile(profile.id);
  }, [profile?.id, workerProfile, loadProfile]);

  const workerLat = workerProfile?.last_lat;
  const workerLng = workerProfile?.last_lng;

  const query = useQuery({
    queryKey: ['radar-inbox', profile?.id, radiusKm, workerLat, workerLng],
    queryFn: () => fetchRadarInboxData({
      workerId: profile!.id,
      profile: profile!,
      radiusKm,
      workerLat,
      workerLng,
    }),
    enabled: !!profile?.id && profile.role === 'worker',
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    radiusKm,
    ratingAvg: workerProfile?.rating_avg ?? null,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url,
    isOnline: workerProfile?.availability_status === 'available',
  };
}
