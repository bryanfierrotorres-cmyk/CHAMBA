import { StyleSheet } from 'react-native';

export const CHAMBA = {
  bg: '#F2F4F7',
  white: '#FFFFFF',
  navy: '#0F172A',
  muted: '#8A94A6',
  /** Azul profundo — botones activos, switches ON, pill seleccionado */
  primary: '#1E293B',
  /** Texto de opciones inactivas en toggles/segmentos */
  inactive: '#6B7280',
  cyan: '#00F2FE',
  blue: '#0284C7',
  teal: '#0D9488',
  error: '#EF4444',
  /** Fondo de contenedores de toggles y segmentos */
  toggleBg: '#F3F4F6',
  border: '#E2E8F0',
} as const;

/** Pill activo del segmento — azul profundo sofisticado (contraste WCAG ≥ 4.5:1 con texto blanco) */
export const GRADIENT_TOGGLE = ['#1E293B', '#334155'] as const;

export const CARD_STEP_SHADOW = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 4,
} as const;

/** Área mínima táctil recomendada para móvil (Material / iOS HIG). */
export const TOUCH_TARGET_MIN = 48;

/** Fondos mate para íconos de subcategorías Express (sin azul uniforme). */
export const SUBCATEGORY_MATT_COLORS = [
  '#5B7A6A',
  '#4A6578',
  '#5C6470',
  '#8A7342',
  '#9A6B5C',
  '#6B5B7A',
] as const;

export const getSubcategoryIconColor = (index: number): string =>
  SUBCATEGORY_MATT_COLORS[index % SUBCATEGORY_MATT_COLORS.length];

export const chambaStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CHAMBA.bg },
  screenHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: CHAMBA.bg,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: CHAMBA.navy,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 15,
    color: CHAMBA.muted,
    marginTop: 2,
    fontWeight: '400',
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: CHAMBA.navy,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: CHAMBA.muted,
    marginTop: 2,
    fontWeight: '400',
    lineHeight: 20,
  },
  stepCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    ...CARD_STEP_SHADOW,
  },
  stepCardContent: { flex: 1, paddingRight: 12, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy, marginBottom: 2 },
  cardSubtitle: {
    fontSize: 14,
    color: CHAMBA.muted,
    fontWeight: '400',
    lineHeight: 20,
  },
  iconCircleRight: {
    width: TOUCH_TARGET_MIN,
    height: TOUCH_TARGET_MIN,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  tabOuterContainer: {
    flexDirection: 'row',
    backgroundColor: CHAMBA.toggleBg,
    borderRadius: 30,
    padding: 6,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6B7A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tabActiveTouchable: {
    flex: 1,
    borderRadius: 24,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  gradientButton: {
    minHeight: TOUCH_TARGET_MIN,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  tabInactiveButton: {
    flex: 1,
    minHeight: TOUCH_TARGET_MIN,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTextActive: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  tabTextInactive: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  panelCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    ...CARD_STEP_SHADOW,
  },
  emptyCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    ...CARD_STEP_SHADOW,
  },
  sectionHeader: { marginBottom: 14 },
  catalogPanel: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
    ...CARD_STEP_SHADOW,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: CHAMBA.navy,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  formInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CHAMBA.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CHAMBA.border,
    paddingHorizontal: 14,
    ...CARD_STEP_SHADOW,
  },
  formInputRowError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '500',
  },
  priceLine: {
    fontSize: 13,
    fontWeight: '700',
    color: CHAMBA.blue,
    lineHeight: 18,
  },
  demandBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demandBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: CHAMBA.blue,
  },
});
