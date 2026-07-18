import { Platform } from 'react-native';
import { supabase } from '@services/supabase';
import { ENV } from '@utils/env';
import { demoLatency } from '@/demo/demoDb';

const IS_DEMO = ENV.DATA_MODE === 'demo';

const BUCKET = 'worker-documents';

/** Sube documento de técnico (cédula / récord) a Supabase Storage. */
export async function uploadWorkerDocument(
  userId: string,
  localUri: string,
  docType: 'cedula' | 'record_policia',
): Promise<string> {
  // DEMO: sin Storage real — la URI local sirve para la vista previa del onboarding.
  if (IS_DEMO) {
    await demoLatency();
    return localUri;
  }

  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('No se pudo leer el archivo seleccionado');
  }

  const blob = await response.blob();
  const contentType = blob.type || 'image/jpeg';
  const path = `${userId}/${docType}.jpg`;

  const body = Platform.OS === 'web' ? blob : await blob.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true });

  if (error) {
    throw new Error(`Error al subir el documento: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export const isDisplayableDocUrl = (url?: string | null): url is string =>
  !!url && url.trim().length > 0;
