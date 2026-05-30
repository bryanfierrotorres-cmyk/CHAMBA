/**
 * Worker section — Material 3 design tokens (Stitch)
 * Use ONLY in worker screens / navigator. Client & admin keep theme.ts.
 */
import {
  BORDER_RADIUS,
  CARD_SHADOW,
  CARD_SHADOW_MD,
  FONT_SIZE,
  FONT_WEIGHT,
  SPACING,
} from './theme';

/** Raw Material 3 tokens from Stitch */
export const M3 = {
  primary: '#004ac6',
  onPrimary: '#ffffff',
  primaryContainer: '#2563eb',
  onPrimaryContainer: '#eeefff',
  primaryFixed: '#dbe1ff',
  primaryFixedDim: '#b4c5ff',
  onPrimaryFixed: '#00174b',
  onPrimaryFixedVariant: '#003ea8',
  secondary: '#006c49',
  onSecondary: '#ffffff',
  secondaryContainer: '#6cf8bb',
  onSecondaryContainer: '#00714d',
  secondaryFixed: '#6ffbbe',
  secondaryFixedDim: '#4edea3',
  onSecondaryFixed: '#002113',
  onSecondaryFixedVariant: '#005236',
  tertiary: '#943700',
  onTertiary: '#ffffff',
  tertiaryContainer: '#bc4800',
  onTertiaryContainer: '#ffede6',
  tertiaryFixed: '#ffdbcd',
  tertiaryFixedDim: '#ffb596',
  onTertiaryFixed: '#360f00',
  onTertiaryFixedVariant: '#7d2d00',
  background: '#f8f9ff',
  onBackground: '#0b1c30',
  surface: '#f8f9ff',
  onSurface: '#0b1c30',
  surfaceVariant: '#d3e4fe',
  onSurfaceVariant: '#434655',
  surfaceDim: '#cbdbf5',
  surfaceBright: '#f8f9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#eff4ff',
  surfaceContainer: '#e5eeff',
  surfaceContainerHigh: '#dce9ff',
  surfaceContainerHighest: '#d3e4fe',
  outline: '#737686',
  outlineVariant: '#c3c6d7',
  inverseSurface: '#213145',
  inverseOnSurface: '#eaf1ff',
  inversePrimary: '#b4c5ff',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
} as const;

/** Drop-in palette compatible with existing COLORS.* usage in worker screens */
export const WORKER_COLORS = {
  brand: {
    50:  M3.primaryFixed,
    100: M3.primaryFixedDim,
    200: M3.inversePrimary,
    300: M3.surfaceContainerHigh,
    400: M3.primaryContainer,
    500: M3.primary,
    600: M3.primaryContainer,
    700: M3.onPrimaryFixedVariant,
    800: M3.onPrimaryFixed,
    900: M3.inverseSurface,
  },
  bg: {
    primary:   M3.background,
    secondary: M3.surfaceContainerLow,
    card:      M3.surfaceContainerLowest,
    elevated:  M3.surfaceContainer,
    input:     M3.surfaceContainerLow,
    navy:      M3.inverseSurface,
  },
  border: {
    subtle:  M3.outlineVariant,
    default: M3.outline,
    strong:  M3.onSurfaceVariant,
  },
  text: {
    primary:   M3.onSurface,
    secondary: M3.onSurfaceVariant,
    muted:     M3.outline,
    inverse:   M3.onPrimary,
    onNavy:    M3.inverseOnSurface,
  },
  status: {
    open:       '#006c49',
    taken:      M3.tertiary,
    inProgress: M3.primary,
    completed:  '#005236',
    cancelled:  M3.error,
  },
  error:       M3.error,
  warning:     M3.tertiary,
  success:     M3.secondary,
  info:        M3.primary,
  gold:        M3.tertiaryContainer,
  white:       M3.surfaceContainerLowest,
  black:       M3.onBackground,
  transparent: 'transparent',
} as const;

export const WORKER_SPACING = {
  ...SPACING,
  touchTargetMin: 48,
  stackGap: 12,
  containerPadding: 16,
} as const;

export {
  BORDER_RADIUS,
  CARD_SHADOW,
  CARD_SHADOW_MD,
  FONT_SIZE,
  FONT_WEIGHT,
  SPACING,
};
