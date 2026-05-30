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
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export type JobStatus = 'open' | 'taken' | 'in_progress' | 'completed' | 'cancelled';

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
  pay_amount: number;
  platform_fee: number;
  worker_payout: number;
  location: JobLocation;
  scheduled_at: string | null;
  duration_hours: number;
  required_workers: number;
  slots_taken: number;
  media_urls: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
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
  type: 'new_job' | 'job_taken' | 'job_completed' | 'payment_sent';
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
};

export type JobStackParamList = {
  JobList:    undefined;
  JobDetail:  { jobId: string };
  JobMap:     { jobId: string };
  JobActive:  { jobId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Onboarding:  undefined;
};

export type WorkerTabParamList = {
  JobFeed:    NavigatorScreenParams<JobStackParamList> | undefined;
  MyJobs:     undefined;
  Profile:    NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type AdminTabParamList = {
  Dashboard: undefined;
  PublishJob: undefined;
  ManageWorkers: undefined;
  Profile: undefined;
};

// ─── Client navigation ────────────────────────────────────────────────────────

export type ClientStackParamList = {
  CategoryGrid: undefined;
  CreateJobForm: { clientCategory: ClientCategory; serviceLabel: string };
  ClientJobDetail: { jobId: string };
};

export type ClientTabParamList = {
  ClientHome:   NavigatorScreenParams<ClientStackParamList> | undefined;
  ClientOrders: undefined;
  Profile:      undefined;
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
