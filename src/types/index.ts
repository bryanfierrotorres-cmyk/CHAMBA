import type { NavigatorScreenParams } from '@react-navigation/native';
import type { JobCategory, ClientCategory } from '@constants/chambaCategories';

// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'worker' | 'client';

export type AvailabilityStatus = 'available' | 'busy' | 'offline';

export type WorkerStatus =
  | 'incomplete'        // just registered, hasn't uploaded docs yet
  | 'pending_approval'  // docs uploaded, waiting for admin
  | 'active'            // approved and working
  | 'suspended';        // manually suspended by admin

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_approved: boolean;
  worker_status:        WorkerStatus | null;
  // Onboarding docs
  cedula_url:           string | null;
  record_policia_url:   string | null;
  // Specialties (workers only)
  category_1:           JobCategory | null;
  category_2:           JobCategory | null;
  category_1_approved:  boolean;
  category_2_approved:  boolean;
  // Payments
  stripe_account_id: string | null;
  fcm_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerProfile {
  worker_id:           string;
  bio:                 string | null;
  skills:              string[];
  id_document_url:     string | null;
  id_verified:         boolean;
  rating_avg:          number | null;   // 1.00 – 5.00
  total_reviews:       number;
  total_jobs_done:     number;
  availability_status: AvailabilityStatus;
  /** Última GPS reportada (Radar / Agenda). */
  last_lat?:            number | null;
  last_lng?:            number | null;
  last_location_at?:    string | null;
  updated_at:          string;
}

export type ReviewerRole = 'admin' | 'client';

export interface WorkerReview {
  id: string;
  worker_id: string;
  reviewer_id: string;
  reviewer_role: ReviewerRole;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
  reviewer?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export interface WorkerRatingSummary {
  rating_avg: number | null;
  total_reviews: number;
}

export interface AssignedWorkerSummary {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
}

export interface ClientOrderJob extends Job {
  assigned_worker_id?: string | null;
  assigned_worker?: AssignedWorkerSummary | null;
  /** Postulaciones pendientes de decisión (máx. 3). */
  pending_applications_count?: number;
}

/** Postulación de técnico a una solicitud del cliente. */
export type JobApplicationSelectionStatus = 'pending' | 'approved' | 'rejected';

export interface JobWorkerApplication {
  assignment_id: string;
  job_id: string;
  worker_id: string;
  assigned_at: string;
  selection_status: JobApplicationSelectionStatus;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  category_1: string | null;
  category_2: string | null;
  rating_avg: number | string | null;
  total_reviews: number | null;
  total_jobs_done?: number | null;
  /** Bio del técnico (RPC get_job_worker_applications). */
  bio?: string | null;
  /** Opcional: distancia precalculada en RPC (km). */
  distance_km?: number | null;
  /** Opcional: coords del técnico para cálculo local de distancia. */
  worker_lat?: number | null;
  worker_lng?: number | null;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export type JobStatus = 'open' | 'taken' | 'in_progress' | 'completed' | 'cancelled';

export type JobModerationReason = 'spam' | 'mistake' | 'admin';

/** Urgencia del servicio para decisión del técnico. */
export type UrgencyLevel = 'hoy' | 'manana' | 'programado';

/** Progreso operativo del técnico en campo (viaje → llegada → cierre). */
export type WorkerOperationalPhase = 'accepted' | 'en_route' | 'arrived' | 'completed';

export type { JobCategory, ClientCategory };
export {
  CHAMBA_CATEGORY_IDS,
  CHAMBA_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_EMOJIS,
  CLIENT_CATEGORY_MAP,
  isJobCategory,
} from '@constants/chambaCategories';

export interface JobLocation {
  address: string;
  lat: number;
  lng: number;
  distance_km?: number;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  category: JobCategory;
  status: JobStatus;
  operational_phase?: WorkerOperationalPhase | null;
  pay_amount: number;
  platform_fee: number;
  worker_payout: number;
  location: JobLocation;
  scheduled_at: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  urgency_level?: UrgencyLevel;
  duration_hours: number;
  required_workers: number;
  slots_taken: number;
  media_urls: string[];
  before_photo_url?: string | null;
  after_photo_url?: string | null;
  created_by: string;
  assigned_worker_id?: string | null;
  created_at: string;
  updated_at: string;
  moderated_by?: string | null;
  moderation_reason?: JobModerationReason | null;
  moderated_at?: string | null;
  creator?: Partial<UserProfile>;
}

export interface JobAssignment {
  id: string;
  job_id: string;
  worker_id: string;
  assigned_at: string;
  completed_at: string | null;
  payment_status: 'pending' | 'processing' | 'paid' | 'failed';
  payment_intent_id: string | null;
  selection_status?: JobApplicationSelectionStatus | null;
  worker?: Partial<UserProfile>;
  job?: Partial<Job>;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface PaymentSummary {
  job_id: string;
  pay_amount: number;
  platform_fee: number;
  worker_payout: number;
  payment_intent_id: string | null;
  status: 'pending' | 'processing' | 'paid' | 'failed';
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'new_job' | 'job_taken' | 'job_completed' | 'job_update' | 'payment_sent';
  data: Record<string, string>;
  read: boolean;
  created_at: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RoleSelection: { email: string; password: string };
  VerifyOtp: { phone: string; role: UserRole };
};

export type JobStackParamList = {
  JobList:    undefined;
  JobDetail:  { jobId: string };
  JobMap:     { jobId: string };
  JobActive:  { jobId: string };
  JobChat:    { jobId: string; clientId?: string; readOnly?: boolean };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Onboarding:  undefined;
};

export type WorkerTabParamList = {
  JobFeed:    NavigatorScreenParams<JobStackParamList> | undefined;
  MyJobs:     undefined;
  Wallet:     undefined;
  Profile:    NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type AdminTabParamList = {
  Dashboard: undefined;
  PublishJob: undefined;
  ManageCatalog: undefined;
  ManageWorkers: undefined;
  Profile: undefined;
};

// ─── Client navigation ────────────────────────────────────────────────────────

export type ClientStackParamList = {
  CategoryGrid: undefined;
  CreateJobForm: {
    serviceTypeSlug: string;
    serviceLabel: string;
    /** @deprecated usar serviceTypeSlug */
    clientCategory?: ClientCategory;
  };
  ClientJobDetail: { jobId: string };
};

export type ClientOrdersStackParamList = {
  ClientOrdersList: undefined;
  ClientCompletedJob: { jobId: string };
  JobChat: { jobId: string; clientId?: string; readOnly?: boolean };
};

export type ClientTabParamList = {
  ClientHome:   NavigatorScreenParams<ClientStackParamList> | undefined;
  ClientOrders: NavigatorScreenParams<ClientOrdersStackParamList> | undefined;
  Profile:      undefined;
};

/** Resumen de chamba completada (vista cliente). */
export interface ClientJobSummary {
  job: ClientOrderJob;
  completed_at: string | null;
  client_review: WorkerReview | null;
  worker_rating_avg: number | null;
}

/** Mensaje de chat 1:1 por servicio (tabla `mensajes`). */
export interface ServiceMessage {
  id: string;
  servicio_id: string;
  remitente_id: string;
  texto: string;
  creado_al: string;
  isOptimistic?: boolean;
}

export interface TypingBroadcastPayload {
  type: 'broadcast';
  event: 'typing';
  payload: {
    userId: string;
    isTyping: boolean;
  };
}

export type JobChatStackParamList = {
  JobChat: {
    jobId: string;
    clientId?: string;
    readOnly?: boolean;
  };
};

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
