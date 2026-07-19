import { Platform, type ViewStyle } from 'react-native';

export const INICIO = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#F3F4F6',
  textStrong: '#1F2937',
  textMedium: '#6B7280',
  textFaint: '#9CA3AF',
  blue: '#2563EB',
  blueIcon: '#3B82F6',
  blueSoft: '#DBEAFE',
  green: '#22C55E',
  greenText: '#16A34A',
  greenSoft: '#DCFCE7',
  greenSurface: '#F0FDF4',
  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  amberSurface: '#FFFBEB',
  teal: '#14B8A6',
  tealText: '#115E59',
  tealSoft: '#CCFBF1',
  tealSurface: '#F0FDFA',
  purple: '#9333EA',
  purpleSoft: '#F3E8FF',
  red: '#EF4444',
  redSoft: '#FEE2E2',
  indigoSurface: '#EEF2FF',
  indigoSoft: '#E0E7FF',
  indigoBorder: '#C7D2FE',
  blueChartLight: '#BFDBFE',
  blueChartMid: '#93C5FD',
} as const;

export const CARD_RADIUS = 16;
export const INNER_RADIUS = 12;

export const INICIO_CARD_SHADOW: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  android: { elevation: 2 },
  default: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
}) as ViewStyle;
