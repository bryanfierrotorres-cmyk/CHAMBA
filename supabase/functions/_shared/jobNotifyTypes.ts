/** Tipos compartidos — notify-new-job / send-push-notification */

export interface JobInsertRecord {
  id: string;
  title?: string | null;
  category?: string | null;
  status?: string | null;
  pay_amount?: number | null;
  worker_payout?: number | null;
}

export interface DbWebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: JobInsertRecord;
}

export interface WorkerProfileRow {
  id: string;
  category_1: string | null;
  category_2: string | null;
  category_1_approved: boolean | null;
  category_2_approved: boolean | null;
  fcm_token: string | null;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data?: Record<string, string>;
  badge?: number;
}

export type PushNotificationType =
  | 'new_job'
  | 'job_taken'
  | 'job_completed'
  | 'job_update'
  | 'payment_sent';

export interface SendPushPayload {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  type: PushNotificationType;
}
