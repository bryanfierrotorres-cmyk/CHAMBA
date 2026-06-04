import type { Job } from '@/types';

/** Foto de referencia que el cliente adjunta al publicar la solicitud (media_urls[0]). */
export const getJobRequestPhotoUrl = (
  job: Pick<Job, 'media_urls'>,
): string | null => {
  const url = job.media_urls?.[0];
  return url && url.trim().length > 0 ? url.trim() : null;
};

export const jobHasRequestPhoto = (job: Pick<Job, 'media_urls'>): boolean =>
  getJobRequestPhotoUrl(job) != null;
