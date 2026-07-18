import { supabase } from '@services/supabase';
import { trackEvent } from '@services/analytics';
import { coerceNumber } from '@utils/formatters';
import { ENV } from '@utils/env';
import type { UserRole, WorkerReview, WorkerRatingSummary } from '@/types';
import {
  getLocalWorkerReviews,
  upsertLocalWorkerReview,
  computeLocalRatingSummary,
} from '@utils/localReviews';

/** True cuando la app corre 100 % offline con el backend demo en memoria. */
const IS_DEMO = ENV.DATA_MODE === 'demo';

const parseReviewsPayload = (data: unknown): WorkerReview[] => {
  if (Array.isArray(data)) return data as WorkerReview[];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? (parsed as WorkerReview[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const fetchWorkerReviews = async (workerId: string): Promise<WorkerReview[]> => {
  const local = await getLocalWorkerReviews(workerId);

  if (IS_DEMO) return local;

  const { data, error } = await supabase.rpc('get_worker_reviews', {
    p_worker_id: workerId,
  });

  if (error) {
    if (local.length > 0) return local;
    return [];
  }

  const remote = parseReviewsPayload(data);
  if (remote.length === 0 && local.length > 0) return local;

  const byId = new Map<string, WorkerReview>();
  for (const r of remote) byId.set(`${r.worker_id}-${r.reviewer_id}`, r);
  for (const r of local) {
    const key = `${r.worker_id}-${r.reviewer_id}`;
    if (!byId.has(key)) byId.set(key, r);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};

export const fetchWorkerRatingSummary = async (
  workerId: string,
): Promise<WorkerRatingSummary> => {
  const reviews = await fetchWorkerReviews(workerId);
  const fromReviews = computeLocalRatingSummary(reviews);

  if (IS_DEMO) return fromReviews;

  const { data, error } = await supabase
    .from('worker_profiles')
    .select('rating_avg, total_reviews')
    .eq('worker_id', workerId)
    .maybeSingle();

  if (error || !data) return fromReviews;

  const ratingRaw = data.rating_avg ?? fromReviews.rating_avg;
  const ratingNum = ratingRaw == null || ratingRaw === ''
    ? null
    : coerceNumber(ratingRaw, NaN);

  return {
    rating_avg: Number.isFinite(ratingNum) ? ratingNum : fromReviews.rating_avg,
    total_reviews: coerceNumber(data.total_reviews ?? fromReviews.total_reviews, 0),
  };
};

export interface SubmitReviewParams {
  workerId: string;
  reviewerId: string;
  reviewerRole: Extract<UserRole, 'admin' | 'client' | 'worker'>;
  reviewerName: string;
  rating: number;
  comment: string;
  /** Rol del sujeto calificado. Default 'worker' (compatibilidad). */
  subjectRole?: 'worker' | 'client';
}

export const submitWorkerReview = async ({
  workerId,
  reviewerId,
  reviewerRole,
  reviewerName,
  rating,
  comment,
  subjectRole = 'worker',
}: SubmitReviewParams): Promise<WorkerReview> => {
  const trimmed = comment.trim();
  if (trimmed.length < 3) {
    throw new Error('El comentario debe tener al menos 3 caracteres');
  }

  if (IS_DEMO) {
    const now = new Date().toISOString();
    return upsertLocalWorkerReview({
      id: `${workerId}-${reviewerId}`,
      worker_id: workerId,
      reviewer_id: reviewerId,
      reviewer_role: reviewerRole,
      rating,
      comment: trimmed,
      created_at: now,
      updated_at: now,
      reviewer: { full_name: reviewerName, avatar_url: null },
    });
  }

  const { data, error } = await supabase.rpc('submit_worker_review', {
    p_worker_id:     workerId,
    p_reviewer_id:   reviewerId,
    p_reviewer_role: reviewerRole,
    p_rating:        rating,
    p_comment:       trimmed,
    p_subject_role:  subjectRole,
  });

  if (!error && data && (data as { success?: boolean }).success) {
    const review = (data as { review: WorkerReview }).review;
    trackEvent('review_sent', reviewerId, {
      worker_id: workerId,
      rating,
    });
    return review;
  }

  const now = new Date().toISOString();
  const localReview: WorkerReview = {
    id: `${workerId}-${reviewerId}`,
    worker_id: workerId,
    reviewer_id: reviewerId,
    reviewer_role: reviewerRole,
    rating,
    comment: trimmed,
    created_at: now,
    updated_at: now,
    reviewer: { full_name: reviewerName, avatar_url: null },
  };

  return upsertLocalWorkerReview(localReview);
};
