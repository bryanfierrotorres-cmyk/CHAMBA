import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/** Diálogo de confirmación que funciona en web y nativo. */
export const confirmAction = ({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
}: ConfirmOptions): Promise<boolean> => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-restricted-globals
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
};

/** Mensaje de éxito / error visible en web y nativo. */
export const showMessage = (title: string, message?: string): void => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
};
