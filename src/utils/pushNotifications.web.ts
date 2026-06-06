export type PushRegistrationFailureReason =
  | 'unsupported_platform'
  | 'not_physical_device'
  | 'permission_denied'
  | 'missing_project_id'
  | 'token_fetch_failed'
  | 'persist_failed';

export interface PushRegistrationResult {
  token: string | null;
  reason?: PushRegistrationFailureReason;
}

export interface PersistPushTokenResult {
  ok: boolean;
  errorMessage?: string;
}

export function configurePushNotificationHandler(): void {
  /* Web: sin handler nativo */
}

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  return { token: null, reason: 'unsupported_platform' };
}

export async function persistPushTokenToProfile(
  _userId: string,
  _token: string,
): Promise<PersistPushTokenResult> {
  return { ok: false, errorMessage: 'unsupported_platform' };
}

export async function syncPushTokenForUser(_userId: string): Promise<PushRegistrationResult> {
  return { token: null, reason: 'unsupported_platform' };
}
