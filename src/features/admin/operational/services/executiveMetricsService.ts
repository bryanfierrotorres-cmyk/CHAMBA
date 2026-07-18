import { supabase } from '@services/supabase';

/**
 * Cuenta técnicos disponibles ahora mismo — agregado (`count: 'exact', head: true`),
 * no trae filas. Único query nuevo del Dashboard Ejecutivo; el resto de las métricas
 * se calculan sobre los jobs que `fetchAdminJobs()` ya trae.
 */
export const fetchAvailableWorkersCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('worker_profiles')
    .select('worker_id', { count: 'exact', head: true })
    .eq('availability_status', 'available');

  if (error) {
    console.warn('[fetchAvailableWorkersCount]', error.message);
    return 0;
  }
  return count ?? 0;
};

/**
 * IDs de técnicos disponibles ahora mismo (solo la columna, sin join). Se cruza
 * del lado del cliente con `fetchAllWorkers()` (mismo query key que ya usa
 * ManageWorkersScreen, React Query lo dedupe) para obtener nombre/teléfono sin
 * un segundo query con join anidado.
 */
export const fetchAvailableWorkerIds = async (): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('worker_id')
    .eq('availability_status', 'available');

  if (error) {
    console.warn('[fetchAvailableWorkerIds]', error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r: { worker_id: string }) => r.worker_id));
};

/**
 * Promedio ponderado de calificación de técnicos (worker_profiles.rating_avg,
 * NO profiles.rating_avg — ese campo es la reputación que recibe un CLIENTE).
 * Ponderado por total_reviews para que un técnico con 50 reseñas pese más que
 * uno con 1 sola. Trae solo 2 columnas de todos los técnicos calificados — barato.
 */
export const fetchAverageWorkerRating = async (): Promise<{ average: number | null; totalReviews: number }> => {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('rating_avg, total_reviews')
    .gt('total_reviews', 0);

  if (error) {
    console.warn('[fetchAverageWorkerRating]', error.message);
    return { average: null, totalReviews: 0 };
  }
  const rows = (data ?? []) as Array<{ rating_avg: number | null; total_reviews: number }>;
  const totalReviews = rows.reduce((sum, r) => sum + (r.total_reviews ?? 0), 0);
  if (totalReviews === 0) return { average: null, totalReviews: 0 };

  const weightedSum = rows.reduce(
    (sum, r) => sum + (r.rating_avg ?? 0) * (r.total_reviews ?? 0),
    0,
  );
  return { average: weightedSum / totalReviews, totalReviews };
};
