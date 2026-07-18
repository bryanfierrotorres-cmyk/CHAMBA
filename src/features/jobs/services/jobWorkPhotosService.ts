import { Platform } from 'react-native';
import { supabase } from '@services/supabase';
import { ENV } from '@utils/env';
import { demoDb, demoLatency } from '@/demo/demoDb';
import type { Job } from '@/types';

const IS_DEMO = ENV.DATA_MODE === 'demo';

const BUCKET = 'job-work-photos';

export type WorkPhotoKind = 'before' | 'after';

export async function uploadJobWorkPhoto(
  jobId: string,
  localUri: string,
  kind: WorkPhotoKind,
): Promise<string> {
  // DEMO: sin Storage real — la URI local sirve directamente como <Image>.
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
  const path = `${jobId}/${kind}.jpg`;

  const body = Platform.OS === 'web' ? blob : await blob.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true });

  if (error) {
    throw new Error(`Error al subir la foto: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
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

  if (IS_DEMO) {
    const job = await demoDb.updateJobPhotos(jobId, patch);
    if (!job) throw new Error('Solicitud no encontrada');
    return job;
  }

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
