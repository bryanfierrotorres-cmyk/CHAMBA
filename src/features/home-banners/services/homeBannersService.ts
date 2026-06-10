import { Platform } from 'react-native';
import { supabase } from '@services/supabase';
import { blobToDataUri } from '@features/jobs/services/jobWorkPhotosService';
import { resolveAdminActorProfile } from '@utils/profileSync';
import { ensurePhoneAuthSession } from '@utils/phoneAuthSession';
import { HOME_BANNERS_BUCKET, type HomeBanner } from '../types';
import type { UserProfile } from '@/types';

const BANNER_SELECT = 'id, image_url, display_order, is_active, created_at';

const newBannerId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const normalizeImageContentType = (blob: Blob, extension: string): string => {
  const raw = blob.type?.toLowerCase() ?? '';
  if (raw && raw !== 'application/octet-stream') {
    if (raw === 'image/jpg') return 'image/jpeg';
    return raw;
  }
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/jpeg';
};

const resolveAdminProfile = async (profile: UserProfile): Promise<UserProfile> => {
  const adminProfile = await resolveAdminActorProfile(profile);
  await ensurePhoneAuthSession(adminProfile);
  return adminProfile;
};

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

export const fetchAllHomeBannersAdmin = async (profile: UserProfile): Promise<HomeBanner[]> => {
  const adminProfile = await resolveAdminProfile(profile);

  const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_list_home_banners', {
    p_admin_id: adminProfile.id,
  });
  if (!rpcErr && Array.isArray(rpcData)) {
    return rpcData as HomeBanner[];
  }

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
  if (!response.ok) {
    throw new Error('No se pudo leer la imagen seleccionada');
  }

  const blob = await response.blob();
  const extRaw = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const extension = extRaw === 'jpeg' ? 'jpg' : extRaw;
  const path = `${bannerId}/banner.${extension}`;
  const contentType = normalizeImageContentType(blob, extension);

  try {
    const body = Platform.OS === 'web' ? blob : await blob.arrayBuffer();
    const { error } = await supabase.storage
      .from(HOME_BANNERS_BUCKET)
      .upload(path, body, { upsert: true, contentType });

    if (!error) {
      const { data } = supabase.storage.from(HOME_BANNERS_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }
    console.warn('[uploadBannerImage] Storage:', error.message);
  } catch (storageErr) {
    console.warn('[uploadBannerImage] fallback data URI:', storageErr);
  }

  return blobToDataUri(blob, contentType);
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

const insertBannerAdmin = async (
  adminProfile: UserProfile,
  imageUrl: string,
  bannerId?: string,
  displayOrder?: number,
): Promise<HomeBanner> => {
  const order = displayOrder ?? (await nextDisplayOrder());

  const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_create_home_banner', {
    p_admin_id: adminProfile.id,
    p_image_url: imageUrl,
    p_display_order: order,
    p_is_active: true,
  });

  if (!rpcErr && rpcData) {
    return rpcData as HomeBanner;
  }

  const { data, error } = await supabase
    .from('home_banners')
    .insert({
      id: bannerId ?? newBannerId(),
      image_url: imageUrl,
      display_order: order,
      is_active: true,
    })
    .select(BANNER_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as HomeBanner;
};

export const createHomeBannerFromImage = async (
  localUri: string,
  profile: UserProfile,
): Promise<HomeBanner> => {
  const adminProfile = await resolveAdminProfile(profile);
  const bannerId = newBannerId();
  const imageUrl = await uploadBannerImage(localUri, bannerId);
  return insertBannerAdmin(adminProfile, imageUrl, bannerId);
};

export const setHomeBannerActive = async (
  profile: UserProfile,
  bannerId: string,
  isActive: boolean,
): Promise<void> => {
  const adminProfile = await resolveAdminProfile(profile);

  const { error: rpcErr } = await supabase.rpc('admin_set_home_banner_active', {
    p_admin_id: adminProfile.id,
    p_banner_id: bannerId,
    p_is_active: isActive,
  });
  if (!rpcErr) return;

  const { error } = await supabase
    .from('home_banners')
    .update({ is_active: isActive })
    .eq('id', bannerId);

  if (error) throw new Error(error.message);
};

export const deleteHomeBanner = async (
  profile: UserProfile,
  banner: HomeBanner,
): Promise<void> => {
  const adminProfile = await resolveAdminProfile(profile);

  const storagePath = extractBannerStoragePath(banner.image_url);
  if (storagePath) {
    const { error: storageErr } = await supabase.storage
      .from(HOME_BANNERS_BUCKET)
      .remove([storagePath]);
    if (storageErr) {
      console.warn('[deleteHomeBanner] storage:', storageErr.message);
    }
  }

  const { error: rpcErr } = await supabase.rpc('admin_delete_home_banner', {
    p_admin_id: adminProfile.id,
    p_banner_id: banner.id,
  });
  if (!rpcErr) return;

  const { error } = await supabase.from('home_banners').delete().eq('id', banner.id);
  if (error) throw new Error(error.message);
};
