import { Platform, StyleSheet } from 'react-native';
import { CARD_STEP_SHADOW } from '@constants/chambaUI';

export const PREMIUM_GREEN = '#22c55e';
export const PREMIUM_NAVY = '#1E293B';
export const PREMIUM_MUTED = '#64748B';
export const PREMIUM_FIRE = '#F97316';

/** Avatar ilustrativo 3D en fila de subcategoría. */
export const SERVICE_ROW_THUMB_SIZE = 70;
export const SERVICE_ROW_THUMB_RADIUS = 12;

/** Espacio extra bajo la lista (tab bar + botón Ayuda). */
export const SERVICE_LIST_BOTTOM_PAD = 148;

export const premiumSubcategoryStyles = StyleSheet.create({
  list: {
    gap: 14,
    marginBottom: 4,
    paddingBottom: SERVICE_LIST_BOTTOM_PAD,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    overflow: 'hidden',
    ...CARD_STEP_SHADOW,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbWrap: {
    width: SERVICE_ROW_THUMB_SIZE,
    height: SERVICE_ROW_THUMB_SIZE,
    borderRadius: SERVICE_ROW_THUMB_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbImage: {
    width: SERVICE_ROW_THUMB_SIZE,
    height: SERVICE_ROW_THUMB_SIZE,
  },
  iconFallback: {
    width: SERVICE_ROW_THUMB_SIZE,
    height: SERVICE_ROW_THUMB_SIZE,
    borderRadius: SERVICE_ROW_THUMB_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: PREMIUM_NAVY,
    letterSpacing: -0.25,
    lineHeight: 21,
  },
  description: {
    fontSize: 13,
    color: PREMIUM_MUTED,
    lineHeight: 18,
  },
  indicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_MUTED,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginTop: 12,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 44,
  },
  priceBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 12,
  },
  priceLabel: {
    fontSize: 11,
    color: PREMIUM_MUTED,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: PREMIUM_NAVY,
    marginTop: 1,
    letterSpacing: -0.2,
  },
  actionBtn: {
    backgroundColor: PREMIUM_GREEN,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 12,
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_GREEN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.24,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  actionBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
});
