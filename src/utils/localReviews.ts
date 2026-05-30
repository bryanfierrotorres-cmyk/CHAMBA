import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkerReview } from '@/types';

const STORAGE_KEY = 'CHAMBA_WORKER_REVIEWS';

type StoredReview = WorkerReview & {
  reviewer?: { full_name: string; avatar_url: string | null };
};

const readAll = async (): Promise<StoredReview[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = async (rows: StoredReview[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
};

export const getLocalWorkerReviews = async (workerId: string): Promise<WorkerReview[]> => {
  const rows = await readAll();
  return rows
    .filter((r) => r.worker_id === workerId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const upsertLocalWorkerReview = async (
  review: StoredReview,
): Promise<WorkerReview> => {
  const rows = await readAll();
  const idx = rows.findIndex(
    (r) => r.worker_id === review.worker_id && r.reviewer_id === review.reviewer_id,
  );
  if (idx === -1) rows.unshift(review);
  else rows[idx] = review;
  await writeAll(rows);
  return review;
};

export const computeLocalRatingSummary = (
  reviews: WorkerReview[],
): { rating_avg: number | null; total_reviews: number } => {
  if (reviews.length === 0) return { rating_avg: null, total_reviews: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    rating_avg: Math.round((sum / reviews.length) * 100) / 100,
    total_reviews: reviews.length,
  };
};
