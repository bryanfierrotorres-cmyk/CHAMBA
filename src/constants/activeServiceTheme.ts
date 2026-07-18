import { Platform } from 'react-native';

/**
 * Paleta y sombra compartidas por las pantallas de "servicio activo" —
 * tarjeta del cliente (ClientActiveServiceCard) y pantalla del técnico
 * (JobActiveScreen). Especificación exacta pedida por el usuario, deliberadamente
 * distinta al tema oscuro del resto de la app del técnico (WORKER_COLORS):
 * estas 2 pantallas comparten la misma experiencia "en vivo" entre cliente y
 * técnico y deben verse como una sola unidad de diseño.
 *
 * Actualizado 2026-07-10 a partir del DESIGN.md + code.html generados en
 * Stitch ("Service Flow Modern" / "Detalle de la Chamba") — valores tomados
 * de las clases Tailwind realmente usadas en el HTML exportado (indigo-600,
 * indigo-50, slate-800/400/100), no de los tokens teóricos del DESIGN.md que
 * no llegaron a usarse en el render final.
 */
export const ACTIVE_SERVICE_PALETTE = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  blue: '#4F46E5',
  blueSoft: '#EEF2FF',
  green: '#22C55E',
  greenSoft: '#F0FDF4',
  orange: '#EA580C',
  orangeSoft: '#FFEDD5',
  red: '#EF4444',
  redSoft: '#FEF2F2',
  text: '#1E293B',
  textSecondary: '#94A3B8',
  border: '#F1F5F9',
};

export const ACTIVE_SERVICE_CARD_SHADOW = Platform.select({
  web: { boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' } as object,
  default: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
});
