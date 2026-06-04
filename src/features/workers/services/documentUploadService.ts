import { Platform } from 'react-native';
import { isPilotDocumentBypass } from '@constants/pilot';
import { supabase } from '@services/supabase';

const BUCKET = 'worker-documents';

/** Convierte blob a data URI (fallback piloto / web sin Storage). */
async function blobToDataUri(blob: Blob, contentType = 'image/jpeg'): Promise<string> {
  const FileReaderClass = (globalThis as { FileReader?: typeof FileReader }).FileReader;
  if (FileReaderClass) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReaderClass();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(blob);
    });
  }

  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return `data:${contentType};base64,${btoa(binary)}`;
}

/**
 * Sube documento de técnico (cédula / récord).
 * Storage primero; data URI como fallback para piloto web.
 */
export async function uploadWorkerDocument(
  userId: string,
  localUri: string,
  docType: 'cedula' | 'record_policia',
): Promise<string> {
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('No se pudo leer el archivo seleccionado');
  }

  const blob = await response.blob();
  const contentType = blob.type || 'image/jpeg';
  const path = `${userId}/${docType}.jpg`;

  try {
    const body = Platform.OS === 'web' ? blob : await blob.arrayBuffer();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: true });

    if (!error) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }
    console.warn('[uploadWorkerDocument] Storage fallback:', error.message);
  } catch (storageErr: unknown) {
    const msg = storageErr instanceof Error ? storageErr.message : 'Storage error';
    console.warn('[uploadWorkerDocument] Storage error, using data URI:', msg);
  }

  return blobToDataUri(blob, contentType);
}

export const isDisplayableDocUrl = (url?: string | null): url is string =>
  !!url && !isPilotDocumentBypass(url) && url.trim().length > 0;
