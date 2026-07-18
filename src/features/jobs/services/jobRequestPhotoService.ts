import { Platform } from 'react-native';
import { supabase } from '@services/supabase';
import { ENV } from '@utils/env';
import { demoLatency } from '@/demo/demoDb';

const IS_DEMO = ENV.DATA_MODE === 'demo';

const BUCKET = 'job-work-photos';

/** Sube la foto de referencia del cliente antes de crear la solicitud. */
export async function uploadJobRequestPhoto(
  clientId: string,
  localUri: string,
): Promise<string> {
  // DEMO: no hay Storage real — la URI local (file:// en nativo, blob:/data:
  // en web) sirve directamente como fuente de <Image>, igual que uploadAvatar.
  if (IS_DEMO) {
    await demoLatency();
    return localUri;
  }

  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('No se pudo leer la imagen seleccionada');
  }

  const blob = await response.blob();
  const contentType = blob.type || 'image/jpeg';
  const path = `requests/${clientId}/${Date.now()}.jpg`;

  const body = Platform.OS === 'web' ? blob : await blob.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: false });

  if (error) {
    throw new Error(`Error al subir la foto: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
