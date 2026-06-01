import { supabase } from '@services/supabase';
import { upsertLocalCategory, upsertLocalServiceType } from '@utils/localCatalog';
import { withTimeout } from '@utils/withTimeout';

const REMOTE_TIMEOUT_MS = 8_000;

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'item';

const isRemoteUnavailable = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('522')
    || msg.includes('Timeout')
    || msg.includes('fetch failed')
    || msg.includes('Failed to fetch')
    || msg.includes('<!DOCTYPE html>')
    || msg.includes('Connection timed out')
  );
};

export const adminUpsertCategory = async (
  adminId: string,
  params: { slug: string; name: string; icon: string; imageUrl?: string },
) => {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('admin_upsert_category', {
        p_admin_id: adminId,
        p_slug: params.slug,
        p_name: params.name,
        p_icon: params.icon,
        p_image_url: params.imageUrl ?? null,
      }),
      REMOTE_TIMEOUT_MS,
    );

    if (error) throw error;
    const result = data as { success?: boolean; error?: string };
    if (!result?.success) throw new Error(result?.error ?? 'No se pudo guardar la categoría');
    return result;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Solo administradores')) throw err;
    if (!isRemoteUnavailable(err)) throw err;

    await upsertLocalCategory({
      slug: params.slug,
      name: params.name,
      icon: params.icon,
      imageUrl: params.imageUrl ?? null,
    });
    return { success: true, local: true };
  }
};

export const adminUpsertServiceType = async (
  adminId: string,
  params: {
    categorySlug: string;
    slug: string;
    name: string;
    icon: string;
    description?: string;
    suggestedPrice: number;
    imageUrl?: string;
  },
) => {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('admin_upsert_service_type', {
        p_admin_id: adminId,
        p_category_slug: params.categorySlug,
        p_slug: params.slug,
        p_name: params.name,
        p_icon: params.icon,
        p_description: params.description ?? null,
        p_suggested_price: params.suggestedPrice,
        p_image_url: params.imageUrl ?? null,
      }),
      REMOTE_TIMEOUT_MS,
    );

    if (error) throw error;
    const result = data as { success?: boolean; error?: string };
    if (!result?.success) throw new Error(result?.error ?? 'No se pudo guardar el trabajo');
    return result;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Solo administradores')) throw err;
    if (!isRemoteUnavailable(err)) throw err;

    await upsertLocalServiceType({
      categorySlug: params.categorySlug,
      slug: params.slug,
      name: params.name,
      icon: params.icon,
      description: params.description ?? null,
      suggestedPrice: params.suggestedPrice,
      imageUrl: params.imageUrl ?? null,
    });
    return { success: true, local: true };
  }
};
