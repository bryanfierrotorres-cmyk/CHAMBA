export interface HomeBanner {
  id: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export const HOME_BANNERS_BUCKET = 'banners';
