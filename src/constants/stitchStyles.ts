/**
 * Shared Stitch / Material 3 visual tokens for CHAMBA worker UI.
 */
import { StyleSheet } from 'react-native';
import { M3, FONT_SIZE, SPACING, BORDER_RADIUS } from './workerTheme';

export const CARD_ELEVATION = {
  shadowColor:   '#000',
  shadowOffset:  { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius:  16,
  elevation:     4,
} as const;

export const TAB_BAR_SHADOW = {
  shadowColor:   '#000',
  shadowOffset:  { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius:  12,
  elevation:     8,
} as const;

export const stitchTypography = StyleSheet.create({
  headlineLg: {
    fontSize:   24,
    lineHeight: 32,
    fontWeight: '700',
    color:      M3.onBackground,
  },
  headlineMd: {
    fontSize:   20,
    lineHeight: 28,
    fontWeight: '600',
    color:      M3.onBackground,
  },
  headlineMdMobile: {
    fontSize:   18,
    lineHeight: 24,
    fontWeight: '600',
    color:      M3.onBackground,
  },
  bodyLg: {
    fontSize:   16,
    lineHeight: 24,
    fontWeight: '400',
    color:      M3.onBackground,
  },
  bodySm: {
    fontSize:   14,
    lineHeight: 20,
    fontWeight: '400',
    color:      M3.onSurfaceVariant,
  },
  labelBold: {
    fontSize:   12,
    lineHeight: 16,
    fontWeight: '700',
    color:      M3.onSurfaceVariant,
  },
  displayPrice: {
    fontSize:      32,
    lineHeight:    40,
    fontWeight:    '700',
    letterSpacing: -0.5,
    color:         M3.secondary,
  },
  appTitle: {
    fontSize:   20,
    fontWeight: '700',
    color:      M3.primary,
  },
});

export const stitchLayout = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: M3.background,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom:     SPACING.lg,
  },
  ambientCard: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius:    12,
    overflow:        'hidden',
    ...CARD_ELEVATION,
  },
  ambientCardPadding: {
    padding: SPACING.md,
  },
  divider: {
    height:           1,
    backgroundColor:  M3.outlineVariant,
    opacity:          0.3,
    marginVertical:   SPACING.sm,
  },
  statusPillOnline: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   M3.secondaryContainer,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical:   SPACING.xs,
    borderRadius:      BORDER_RADIUS.full,
  },
  statusPillText: {
    fontSize:   12,
    fontWeight: '700',
    color:      M3.onSecondaryContainer,
  },
  iconCircle: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: M3.surfaceVariant,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconCircleSm: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: M3.surfaceContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
});

export { M3, FONT_SIZE, SPACING, BORDER_RADIUS };
