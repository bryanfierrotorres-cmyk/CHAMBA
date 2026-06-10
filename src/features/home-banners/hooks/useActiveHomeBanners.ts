import { useQuery } from '@tanstack/react-query';
import { fetchActiveHomeBanners } from '../services/homeBannersService';

export const HOME_BANNERS_QUERY_KEY = ['home-banners', 'active'] as const;

export const useActiveHomeBanners = () =>
  useQuery({
    queryKey: HOME_BANNERS_QUERY_KEY,
    queryFn: fetchActiveHomeBanners,
    staleTime: 60_000,
    retry: 1,
  });
