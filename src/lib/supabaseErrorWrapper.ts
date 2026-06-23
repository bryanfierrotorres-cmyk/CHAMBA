/**
 * Wrapper for Supabase async calls that adds automatic retries (2 attempts) for network‑related errors.
 * It logs the original error to the console for debugging, but surfaces a friendly Spanish message
 * to the UI. The wrapper does **not** re‑throw the original error – it throws a generic Error that
 * can be caught by the global `ErrorBoundary` or by the `ErrorBanner` via `useError`.
 */
export async function withSupabaseError<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      // Log technical details for developers
      console.error('[Supabase] error (attempt', attempt + 1, '):', e);

      // Simple heuristic: treat fetch/network failures as retryable.
      const isNetworkError =
        e?.code === 'ECONNREFUSED' ||
        e?.message?.toLowerCase()?.includes('network') ||
        e?.status === 0; // fetch failed without HTTP status

      attempt++;
      if (attempt > maxRetries || !isNetworkError) {
        // After exhausting retries or for non‑network errors, surface a friendly message.
        throw new Error('Algo salió mal. Por favor, intenta de nuevo.');
      }
      // otherwise loop and retry
    }
  }
}
