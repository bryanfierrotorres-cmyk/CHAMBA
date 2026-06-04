import { Platform } from 'react-native';
import { supabase } from '@services/supabase';
import { blobToDataUri } from '@features/jobs/services/jobWorkPhotosService';

const BUCKET = 'job-work-photos';

/** Sube la foto de referencia del cliente antes de crear la solicitud. */
export async function uploadJobRequestPhoto(
  clientId: string,
  localUri: string,
): Promise<string> {
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('No se pudo leer la imagen seleccionada');
  }

  const blob = await response.blob();
  const contentType = blob.type || 'image/jpeg';
  const path = `requests/${clientId}/${Date.now()}.jpg`;

  try {
    const body = Platform.OS === 'web' ? blob : await blob.arrayBuffer();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: false });

    if (!error) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }
    console.warn('[uploadJobRequestPhoto] Storage:', error.message);
  } catch (err) {
    console.warn('[uploadJobRequestPhoto] fallback data URI:', err);
  }

  return blobToDataUri(blob, contentType);
}
