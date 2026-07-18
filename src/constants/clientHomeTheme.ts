import { Platform } from 'react-native';

/**
 * Paleta "premium minimalista" del Home cliente — spec numérica exacta
 * pedida por el usuario (v1.1, valores literales por elemento). Deliberadamente
 * distinta de `CHAMBA` (chambaUI.ts), que es el tema genérico compartido por
 * el resto de pantallas cliente — así evitamos que este rediseño salpique
 * Login, MyJobs, Wallet, etc.
 */
export const HOME_PALETTE = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  blue: '#2563EB',
  blueLight: '#EEF4FF',
  circleLight: '#DCEAFE',
  green: '#22C55E',
  greenLight: '#F0FDF4',
  greenDark: '#15803D',
  teal: '#14B8A6',
  darkGray: '#0F172A',
  locationGray: '#475569',
  midGray: '#64748B',
  placeholderGray: '#94A3B8',
  filterBg: '#F8FAFC',
  lightGray: '#E5E7EB',
  inputBg: '#FFFFFF',
};

/** Sombra tarjetas de servicio: opacity .05, blur 20, offset 0/8. */
export const HOME_CARD_SHADOW = Platform.select({
  web: { boxShadow: '0 8px 20px rgba(0, 0, 0, 0.05)' } as object,
  default: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
});

/** Sombra buscador: opacity .06, blur 20, offset 0/6. */
export const HOME_SEARCH_SHADOW = Platform.select({
  web: { boxShadow: '0 6px 20px rgba(0, 0, 0, 0.06)' } as object,
  default: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
});

/** Sombra suave (tab activo, badge 30 min). */
export const HOME_SOFT_SHADOW = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)' } as object,
  default: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
});
