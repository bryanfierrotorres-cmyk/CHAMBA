import { CHAMBA } from '@constants/chambaUI';

/** Tokens visuales del chat — premium, minimalista, plano. */
export const CHAT_THEME = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  navy: '#111827',
  textPrimary: '#1F2937',
  muted: '#9CA3AF',
  border: '#F3F4F6',
  headerBorder: '#F3F4F6',
  clientAccent: CHAMBA.blue,
  workerAccent: CHAMBA.teal,
  bubbleTheirs: '#F3F4F6',
  bubbleMineClient: CHAMBA.blue,
  bubbleMineWorker: CHAMBA.teal,
  composerBg: '#FFFFFF',
  inputBg: '#F9FAFB',
  badgeBg: '#F3F4F6',
  lockedBannerBg: '#F9FAFB',
  lockedBannerBorder: '#F3F4F6',
  time: '#9CA3AF',
} as const;

/** Pastel suave para badge de servicio en cabecera. */
export const chatServiceBadgeStyle = (accentColor: string) => ({
  backgroundColor: `${accentColor}12`,
  borderColor: `${accentColor}22`,
});
