import { Linking } from 'react-native';
import Constants from 'expo-constants';

/**
 * Enlaces oficiales de cumplimiento (Google Play / Marketplace).
 * Centralizados para reutilizar en los perfiles de Cliente y Técnico.
 */
const LEGAL_BASE = 'https://chamba-woad.vercel.app';

export const LEGAL_LINKS = {
  privacy: `${LEGAL_BASE}/privacy.html`,
  accountDeletion: `${LEGAL_BASE}/eliminar-cuenta.html`,
  terms: `${LEGAL_BASE}/terms.html`,
  community: `${LEGAL_BASE}/community.html`,
  cancellations: `${LEGAL_BASE}/cancellations.html`,
  support: 'mailto:soporte@chamba.app',
} as const;

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const APP_ENV_LABEL = __DEV__ ? 'Desarrollo' : 'Producción';
export const APP_VERSION_LABEL = `Versión ${APP_VERSION} (${APP_ENV_LABEL})`;

/** Abre un enlace legal o de soporte; falla en silencio si el dispositivo no puede abrirlo. */
export const openLegalLink = (url: string): void => {
  void Linking.openURL(url).catch(() => undefined);
};
