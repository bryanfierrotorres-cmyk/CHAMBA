import { supabase } from '@services/supabase';
import { demoDb } from '@/demo/demoDb';
import { ENV } from '@utils/env';
import { JOB_RADAR_EXPIRY_MS } from '@constants/jobExpiry';
import { workerCoversJobCategory } from '@utils/workerCategoryAccess';
import { hasUsableJobCoordinates } from '@utils/shareJobLocation';
import { haversineDistanceKm } from '@utils/geoDistance';
import { RADIUS_OPTIONS_KM } from '@utils/workerSearchRadius';
import { loadRadarDismissedJobIds } from '@utils/radarDismissedJobs';
import { fetchWorkerInicioStats, type WorkerInicioStats } from '@features/workers/services/profileService';
import type { Job, UserProfile } from '@/types';

const IS_DEMO = ENV.DATA_MODE === 'demo';
const DAY_MS = 24 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const THIRTY_MIN_MS = 30 * 60 * 1000;
const BUCKET_START_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];

export interface RadarInboxJob extends Job {
  distanceKm: number | null;
}

export interface RadarInboxData {
  stats: WorkerInicioStats;
  recentRequests: RadarInboxJob[];
  solicitudesHoy: number;
  solicitudesNuevas: number;
  zoneWorkersOnline: number;
  zoneRequestsLast2h: number;
  recommendedRadiusKm: number;
  bestHourLabel: string;
  bestHourBars: number[];
}

export interface RadarInboxParams {
  workerId: string;
  profile: UserProfile;
  radiusKm: number;
  workerLat?: number | null;
  workerLng?: number | null;
}

const isSameLocalDay = (iso: string, ref: Date): boolean => {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate();
};

const formatHour12 = (hour: number): string => {
  const h = ((hour % 24) + 24) % 24;
  const period = h >= 12 ? 'pm' : 'am';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
};

const fetchOpenJobs = async (): Promise<Job[]> => {
  if (IS_DEMO) {
    return demoDb.listOpenJobs();
  }
  const sinceIso = new Date(Date.now() - DAY_MS).toISOString();
  const { data, error } = await supabase
    .from('jobs')
    .select('*, creator:profiles!created_by(id, full_name, avatar_url)')
    .eq('status', 'open')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as Job[];
};

const countWorkersOnline = async (): Promise<number> => {
  if (IS_DEMO) {
    return demoDb.countApprovedWorkers();
  }
  const { count } = await supabase
    .from('worker_profiles')
    .select('worker_id', { count: 'exact', head: true })
    .eq('availability_status', 'available');
  return count ?? 0;
};

const jobDistance = (job: Job, lat?: number | null, lng?: number | null): number | null => {
  const jLat = job.location?.lat;
  const jLng = job.location?.lng;
  if (!hasUsableJobCoordinates(lat, lng) || !hasUsableJobCoordinates(jLat, jLng)) return null;
  const km = haversineDistanceKm(lat!, lng!, jLat!, jLng!);
  return Number.isFinite(km) ? km : null;
};

const computeRecommendedRadius = (distances: number[], currentKm: number): number => {
  const valid = distances.filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
  if (valid.length === 0) return currentKm;
  const p80 = valid[Math.min(valid.length - 1, Math.floor(valid.length * 0.8))];
  const option = RADIUS_OPTIONS_KM.find((km) => km >= p80) ?? RADIUS_OPTIONS_KM[RADIUS_OPTIONS_KM.length - 1];
  return Math.max(currentKm, option);
};

const computeBestHour = (jobs: Job[]): { label: string; bars: number[] } => {
  const buckets = BUCKET_START_HOURS.map(() => 0);
  for (const j of jobs) {
    if (!j.created_at) continue;
    const hour = new Date(j.created_at).getHours();
    for (let i = 0; i < BUCKET_START_HOURS.length; i++) {
      const start = BUCKET_START_HOURS[i];
      if (hour >= start && hour < start + 2) { buckets[i] += 1; break; }
    }
  }
  const max = Math.max(...buckets, 0);
  const bars = max > 0 ? buckets.map((v) => Math.max(0.14, v / max)) : [0.25, 0.35, 0.5, 0.7, 1, 0.8, 0.6, 0.35];
  const peak = max > 0 ? buckets.indexOf(max) : 4;
  const startHour = BUCKET_START_HOURS[peak];
  const label = `${formatHour12(startHour)} – ${formatHour12(startHour + 4)}`;
  return { label, bars };
};

export const fetchRadarInboxData = async (params: RadarInboxParams): Promise<RadarInboxData> => {
  const { workerId, profile, radiusKm, workerLat, workerLng } = params;
  const now = Date.now();
  const nowDate = new Date();

  const [openJobs, stats, zoneWorkersOnline, dismissedIds] = await Promise.all([
    fetchOpenJobs(),
    fetchWorkerInicioStats(workerId),
    countWorkersOnline(),
    loadRadarDismissedJobIds(workerId),
  ]);

  const covered = openJobs.filter((j) => workerCoversJobCategory(profile, j.category));

  // En Inicio aparecen: (a) solicitudes que llevan 1h+ sin tomar (regla de 24h), y
  // (b) las que el técnico "apartó" del radar — esas ya no le interesan ahí, pasan
  // a Inicio de inmediato sin esperar la hora.
  const recentRequests: RadarInboxJob[] = covered
    .filter((j) => {
      if (dismissedIds.has(j.id)) return true;
      const age = now - new Date(j.created_at).getTime();
      return age >= JOB_RADAR_EXPIRY_MS && age <= DAY_MS;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12)
    .map((j) => ({ ...j, distanceKm: jobDistance(j, workerLat, workerLng) }));

  const solicitudesHoy = covered.filter((j) => isSameLocalDay(j.created_at, nowDate)).length;
  const solicitudesNuevas = covered.filter((j) => now - new Date(j.created_at).getTime() <= THIRTY_MIN_MS).length;
  const zoneRequestsLast2h = openJobs.filter((j) => now - new Date(j.created_at).getTime() <= TWO_HOURS_MS).length;

  const distances = covered
    .map((j) => jobDistance(j, workerLat, workerLng))
    .filter((d): d is number => d != null);
  const recommendedRadiusKm = computeRecommendedRadius(distances, radiusKm);

  const { label: bestHourLabel, bars: bestHourBars } = computeBestHour(openJobs);

  return {
    stats,
    recentRequests,
    solicitudesHoy,
    solicitudesNuevas,
    zoneWorkersOnline,
    zoneRequestsLast2h,
    recommendedRadiusKm,
    bestHourLabel,
    bestHourBars,
  };
};
