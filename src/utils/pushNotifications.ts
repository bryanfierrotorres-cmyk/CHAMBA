import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@services/supabase';

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

interface ProfilePushTokenPatch {
  fcm_token: string;
  updated_at: string;
}

interface ExpoExtraConfig {
  eas?: {
    projectId?: string;
  };
}

const ANDROID_CHANNEL_ID = 'chamba-default';

let handlerConfigured = false;

/** Configura heads-up + sonido en primer plano. Idempotente. */
export function configurePushNotificationHandler(): void {
  if (Platform.OS === 'web' || handlerConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  handlerConfigured = true;
}

function resolveExpoProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as ExpoExtraConfig | undefined;
  const projectId = extra?.eas?.projectId?.trim();
  return projectId && projectId.length > 0 ? projectId : null;
}

async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'CHAMBA Notificaciones',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1E293B',
  });
}

/**
 * Solicita permisos y obtiene el Expo Push Token.
 * Falla en silencio en emuladores, simuladores o entornos sin EAS projectId.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { token: null, reason: 'unsupported_platform' };
  }

  try {
    if (!Device.isDevice) {
      return { token: null, reason: 'not_physical_device' };
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { token: null, reason: 'permission_denied' };
    }

    await ensureAndroidNotificationChannel();

    const projectId = resolveExpoProjectId();
    if (!projectId) {
      return { token: null, reason: 'missing_project_id' };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data.trim();
    if (!token) {
      return { token: null, reason: 'token_fetch_failed' };
    }

    return { token };
  } catch (err) {
    if (__DEV__) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[pushNotifications] register failed:', message);
    }
    return { token: null, reason: 'token_fetch_failed' };
  }
}

/** Persiste el Expo Push Token en `profiles.fcm_token` (columna existente). */
export async function persistPushTokenToProfile(
  userId: string,
  token: string,
): Promise<PersistPushTokenResult> {
  const trimmedUserId = userId.trim();
  const trimmedToken = token.trim();

  if (!trimmedUserId || !trimmedToken) {
    return { ok: false, errorMessage: 'invalid_args' };
  }

  const patch: ProfilePushTokenPatch = {
    fcm_token: trimmedToken,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', trimmedUserId);

    if (error) {
      if (__DEV__) {
        console.warn('[pushNotifications] persist failed:', error.message);
      }
      return { ok: false, errorMessage: error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    if (__DEV__) {
      console.warn('[pushNotifications] persist exception:', message);
    }
    return { ok: false, errorMessage: message };
  }
}

/** Registra el token y lo guarda en Supabase para el usuario autenticado. */
export async function syncPushTokenForUser(userId: string): Promise<PushRegistrationResult> {
  const registration = await registerForPushNotificationsAsync();
  if (!registration.token) {
    return registration;
  }

  const persist = await persistPushTokenToProfile(userId, registration.token);
  if (!persist.ok) {
    return { token: registration.token, reason: 'persist_failed' };
  }

  return { token: registration.token };
}
