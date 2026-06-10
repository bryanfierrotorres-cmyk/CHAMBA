import { supabase } from '@services/supabase';
import { HOME_BANNERS_BUCKET, type HomeBanner } from '../types';

const BANNER_SELECT = 'id, image_url, display_order, is_active, created_at';

const newBannerId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export const extractBannerStoragePath = (publicUrl: string): string | null => {
  const marker = `/storage/v1/object/public/${HOME_BANNERS_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length).split('?')[0] || null;
};

export const fetchActiveHomeBanners = async (): Promise<HomeBanner[]> => {
  const { data, error } = await supabase
    .from('home_banners')
    .select(BANNER_SELECT)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as HomeBanner[];
};

export const fetchAllHomeBannersAdmin = async (): Promise<HomeBanner[]> => {
  const { data, error } = await supabase
    .from('home_banners')
    .select(BANNER_SELECT)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as HomeBanner[];
};

const uploadBannerImage = async (localUri: string, bannerId: string): Promise<string> => {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const extRaw = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const extension = extRaw === 'jpeg' ? 'jpg' : extRaw;
  const path = `${bannerId}/banner.${extension}`;
  const contentType = blob.type || (extension === 'png' ? 'image/png' : 'image/jpeg');

  const { error } = await supabase.storage
    .from(HOME_BANNERS_BUCKET)
    .upload(path, blob, { upsert: true, contentType });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(HOME_BANNERS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

const nextDisplayOrder = async (): Promise<number> => {
  const { data, error } = await supabase
    .from('home_banners')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1);

  if (error) return 0;
  const max = data?.[0]?.display_order;
  return typeof max === 'number' ? max + 1 : 0;
};

export const createHomeBannerFromImage = async (localUri: string): Promise<HomeBanner> => {
  const bannerId = newBannerId();
  const imageUrl = await uploadBannerImage(localUri, bannerId);
  const displayOrder = await nextDisplayOrder();

  const { data, error } = await supabase
    .from('home_banners')
    .insert({
      id: bannerId,
      image_url: imageUrl,
      display_order: displayOrder,
      is_active: true,
    })
    .select(BANNER_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as HomeBanner;
};

export const setHomeBannerActive = async (
  bannerId: string,
  isActive: boolean,
): Promise<void> => {
  const { error } = await supabase
    .from('home_banners')
    .update({ is_active: isActive })
    .eq('id', bannerId);

  if (error) throw new Error(error.message);
};

export const deleteHomeBanner = async (banner: HomeBanner): Promise<void> => {
  const storagePath = extractBannerStoragePath(banner.image_url);
  if (storagePath) {
    const { error: storageErr } = await supabase.storage
      .from(HOME_BANNERS_BUCKET)
      .remove([storagePath]);
    if (storageErr) {
      console.warn('[deleteHomeBanner] storage:', storageErr.message);
    }
  }

  const { error } = await supabase.from('home_banners').delete().eq('id', banner.id);
  if (error) throw new Error(error.message);
};
