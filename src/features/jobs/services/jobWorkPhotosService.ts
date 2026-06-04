import { Platform } from 'react-native';
import { supabase } from '@services/supabase';
import type { Job } from '@/types';

const BUCKET = 'job-work-photos';

export type WorkPhotoKind = 'before' | 'after';

export async function blobToDataUri(blob: Blob, contentType = 'image/jpeg'): Promise<string> {
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

export async function uploadJobWorkPhoto(
  jobId: string,
  localUri: string,
  kind: WorkPhotoKind,
): Promise<string> {
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('No se pudo leer la imagen seleccionada');
  }

  const blob = await response.blob();
  const contentType = blob.type || 'image/jpeg';
  const path = `${jobId}/${kind}.jpg`;

  try {
    const body = Platform.OS === 'web' ? blob : await blob.arrayBuffer();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: true });

    if (!error) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }
    console.warn('[uploadJobWorkPhoto] Storage:', error.message);
  } catch (err) {
    console.warn('[uploadJobWorkPhoto] fallback data URI:', err);
  }

  return blobToDataUri(blob, contentType);
}

export async function persistJobWorkPhoto(
  jobId: string,
  workerId: string,
  kind: WorkPhotoKind,
  photoUrl: string,
): Promise<Job> {
  const patch =
    kind === 'before'
      ? { before_photo_url: photoUrl }
      : { after_photo_url: photoUrl };

  const { data: rpcData, error: rpcErr } = await supabase.rpc('worker_update_job_photos', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_before_url: kind === 'before' ? photoUrl : null,
    p_after_url: kind === 'after' ? photoUrl : null,
  });

  if (!rpcErr && (rpcData as { success?: boolean })?.success) {
    const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    if (!error && data) return data as Job;
  }

  const { data, error } = await supabase
    .from('jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Job;
}

export async function uploadAndSaveJobWorkPhoto(
  jobId: string,
  workerId: string,
  localUri: string,
  kind: WorkPhotoKind,
): Promise<Job> {
  const url = await uploadJobWorkPhoto(jobId, localUri, kind);
  return persistJobWorkPhoto(jobId, workerId, kind, url);
}
