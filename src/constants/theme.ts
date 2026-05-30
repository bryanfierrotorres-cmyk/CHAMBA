// ─── New Visual System: Blue/White (Care Clean inspired) ──────────────────────

export const COLORS = {
  // Brand blues (replacing greens)
  brand: {
    50:  '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3B82F6',   // bright blue — primary CTA
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1e40af',
    900: '#1E3A8A',   // deep navy — welcome screen bg
  },

  // Light backgrounds
  bg: {
    primary:  '#F3F4F6',   // light gray page bg
    secondary:'#E9EAEC',
    card:     '#FFFFFF',   // white card
    elevated: '#F8F9FA',
    input:    '#F3F4F6',
    navy:     '#1E3A8A',   // dark hero screens
  },

  // Borders
  border: {
    subtle:  '#E5E7EB',
    default: '#D1D5DB',
    strong:  '#9CA3AF',
  },

  // Text
  text: {
    primary:   '#111827',
    secondary: '#6B7280',
    muted:     '#9CA3AF',
    inverse:   '#FFFFFF',
    onNavy:    '#FFFFFF',
  },

  // Status colors (preserved)
  status: {
    open:       '#22c55e',
    taken:      '#F59E0B',
    inProgress: '#3B82F6',
    completed:  '#8B5CF6',
    cancelled:  '#EF4444',
  },

  // System
  error:       '#EF4444',
  warning:     '#F59E0B',
  success:     '#22C55E',
  info:        '#3B82F6',
  gold:        '#F59E0B',
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
} as const;

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const BORDER_RADIUS = {
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  '2xl': 36,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const FONT_WEIGHT = {
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
} as const;

// Card shadow preset (use with spread)
export const CARD_SHADOW = {
  shadowColor:   '#000',
  shadowOffset:  { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius:  8,
  elevation:     3,
} as const;

export const CARD_SHADOW_MD = {
  shadowColor:   '#000',
  shadowOffset:  { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius:  16,
  elevation:     6,
} as const;

export type StatusColor = keyof typeof COLORS.status;
