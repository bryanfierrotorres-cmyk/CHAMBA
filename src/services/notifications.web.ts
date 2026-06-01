export const registerForPushNotifications = async (_userId: string): Promise<string | null> => null;

export const setupNotificationListeners = (
  _onReceived: (notification: unknown) => void,
  _onResponse: (response: unknown) => void,
) => () => {};
