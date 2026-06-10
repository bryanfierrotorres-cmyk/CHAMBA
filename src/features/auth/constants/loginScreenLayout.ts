/**
 * Medidas fijas del login (hero CHAMBA ↔ formulario).
 * NO modificar sin aprobación explícita del producto — ver .cursor/rules/login-screen-layout-static.mdc
 */
export const LOGIN_SCREEN_LAYOUT = {
  compactBreakpoint: 640,

  scroll: {
    paddingHorizontal: 20,
    paddingTop: { ios: 52, default: 40 },
  },

  hero: {
    paddingTop: { wide: 72, compact: 58 },
    appNameMarginBottom: { wide: 8, compact: 6 },
    taglineMarginBottom: { wide: 16, compact: 8 },
  },

  /** Hueco fijo entre eslogan y tarjeta «Ingresá tus datos» (px). Sin % ni flex. */
  heroCardGap: { wide: 56, compact: 40 },
} as const;
