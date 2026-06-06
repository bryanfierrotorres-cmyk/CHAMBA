import * as Notifications from 'expo-notifications';
import type { Notification, NotificationResponse } from 'expo-notifications';
import {
  configurePushNotificationHandler,
  syncPushTokenForUser,
} from '@utils/pushNotifications';

export {
  configurePushNotificationHandler,
  registerForPushNotificationsAsync,
  persistPushTokenToProfile,
  syncPushTokenForUser,
} from '@utils/pushNotifications';

export type {
  PersistPushTokenResult,
  PushRegistrationFailureReason,
  PushRegistrationResult,
} from '@utils/pushNotifications';

configurePushNotificationHandler();

/** @deprecated Usar syncPushTokenForUser — conservado por compatibilidad. */
export const registerForPushNotifications = async (userId: string): Promise<string | null> => {
  const result = await syncPushTokenForUser(userId);
  return result.token;
};

export const setupNotificationListeners = (
  onReceived: (notification: Notification) => void,
  onResponse: (response: NotificationResponse) => void,
) => {
  const receivedSub = Notifications.addNotificationReceivedListener(onReceived);
  const responseSub = Notifications.addNotificationResponseReceivedListener(onResponse);

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
};
