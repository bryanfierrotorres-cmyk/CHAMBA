import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@store/authStore';
import {
  createHomeBannerFromImage,
  deleteHomeBanner,
  fetchAllHomeBannersAdmin,
  setHomeBannerActive,
} from '../services/homeBannersService';
import { HOME_BANNERS_QUERY_KEY } from './useActiveHomeBanners';
import type { HomeBanner } from '../types';

export const ADMIN_HOME_BANNERS_QUERY_KEY = ['home-banners', 'admin'] as const;

export const useAdminHomeBanners = () => {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  const query = useQuery({
    queryKey: ADMIN_HOME_BANNERS_QUERY_KEY,
    queryFn: () => {
      if (!profile) throw new Error('Sesión de administrador requerida');
      return fetchAllHomeBannersAdmin(profile);
    },
    enabled: !!profile?.id,
    staleTime: 10_000,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_HOME_BANNERS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: HOME_BANNERS_QUERY_KEY });
  };

  const uploadMutation = useMutation({
    mutationFn: (localUri: string) => {
      if (!profile) throw new Error('Sesión de administrador requerida');
      return createHomeBannerFromImage(localUri, profile);
    },
    onSuccess: invalidateAll,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!profile) throw new Error('Sesión de administrador requerida');
      return setHomeBannerActive(profile, id, isActive);
    },
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (banner: HomeBanner) => {
      if (!profile) throw new Error('Sesión de administrador requerida');
      return deleteHomeBanner(profile, banner);
    },
    onSuccess: invalidateAll,
  });

  return {
    banners: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    uploadBanner: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    toggleActive: toggleMutation.mutateAsync,
    togglingId: toggleMutation.isPending ? toggleMutation.variables?.id : null,
    removeBanner: deleteMutation.mutateAsync,
    removingId: deleteMutation.isPending ? deleteMutation.variables?.id : null,
  };
};
