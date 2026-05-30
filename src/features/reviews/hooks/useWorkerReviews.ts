import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkerReviews,
  fetchWorkerRatingSummary,
  submitWorkerReview,
  type SubmitReviewParams,
} from '@features/reviews/services/reviewsService';

export const workerReviewsQueryKey = (workerId: string) => ['worker-reviews', workerId] as const;
export const workerRatingQueryKey = (workerId: string) => ['worker-rating', workerId] as const;

export function useWorkerReviews(workerId: string | undefined) {
  const queryClient = useQueryClient();

  const reviewsQuery = useQuery({
    queryKey: workerReviewsQueryKey(workerId ?? ''),
    queryFn:  () => fetchWorkerReviews(workerId!),
    enabled:  !!workerId,
  });

  const summaryQuery = useQuery({
    queryKey: workerRatingQueryKey(workerId ?? ''),
    queryFn:  () => fetchWorkerRatingSummary(workerId!),
    enabled:  !!workerId,
  });

  const submitMutation = useMutation({
    mutationFn: (params: SubmitReviewParams) => submitWorkerReview(params),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: workerReviewsQueryKey(vars.workerId) });
      queryClient.invalidateQueries({ queryKey: workerRatingQueryKey(vars.workerId) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'workers'] });
    },
  });

  return {
    reviews:      reviewsQuery.data ?? [],
    summary:      summaryQuery.data ?? { rating_avg: null, total_reviews: 0 },
    isLoading:    reviewsQuery.isLoading || summaryQuery.isLoading,
    refetch:      () => Promise.all([reviewsQuery.refetch(), summaryQuery.refetch()]),
    submitReview: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
}
