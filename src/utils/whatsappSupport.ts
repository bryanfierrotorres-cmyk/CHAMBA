import { Linking } from 'react-native';

export const WHATSAPP_SUPPORT_NUMBER = '50578608108';
const DEFAULT_MESSAGE = encodeURIComponent('Hola, necesito ayuda con CHAMBA ⚡');

export const buildWhatsAppSupportUrl = (message?: string): string => {
  const text = encodeURIComponent(message ?? 'Hola, necesito ayuda con CHAMBA ⚡');
  return `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${text}`;
};

export const openWhatsAppSupport = async (message?: string): Promise<void> => {
  const url = buildWhatsAppSupportUrl(message);
  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${DEFAULT_MESSAGE}`);
  }
};
