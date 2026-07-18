/**
 * Datos del banner superior (Home) — carrusel tipo reel con foto de fondo.
 */

import { getHeroSlideImages } from '@constants/clientHomeImages';

export interface ClientHeroSlide {
  id: string;
  title: string;
  subtitle: string;
  imageUri: string;
  imageFallbackUri: string;
  /** Asset local (require) — prioridad sobre imageUri cuando está definido. */
  imageLocal?: number;
  /** Punto focal vertical 0–1 para recorte cover (0=arriba, 1=abajo). */
  imageFocusY?: number;
  placeholderLabel?: string;
  /**
   * Marca este slide como el banner "Servicio Express" (spec v1.0): tarjeta
   * clara con badge + CTA + foto recortada a la derecha + chip flotante de
   * tiempo, en vez del tratamiento foto-completa-oscurecida de los demás
   * slides. Solo el primer slide lo usa.
   */
  isExpressSlide?: boolean;
  badge?: string;
  ctaLabel?: string;
  timeBadge?: string;
}

const slide = (
  id: string,
  title: string,
  subtitle: string,
  placeholderLabel?: string,
  imageLocal?: number,
  imageFocusY?: number,
): ClientHeroSlide => {
  const imgs = getHeroSlideImages(id);
  return {
    id,
    title,
    subtitle,
    imageUri: imgs.primary,
    imageFallbackUri: imgs.fallback,
    placeholderLabel,
    imageLocal,
    imageFocusY,
  };
};

/** Slides — tab Para tu Hogar. */
export const CLIENT_HOGAR_HERO_SLIDES: ClientHeroSlide[] = [
  {
    ...slide(
      'hogar-express-tecnico',
      'Técnico en menos de 30 min',
      'Soluciones rápidas, cuando más las necesitás.',
      'Servicio Express',
    ),
    imageLocal: require('../../assets/banner-tecnico-van-test.jpg'),
    isExpressSlide: true,
    badge: '⚡ Servicio Express',
    ctaLabel: 'Solicitar ahora',
    timeBadge: '30 min',
  },
  slide(
    'hogar-limpieza',
    'Tu hogar impecable sin complicaciones',
    'Profesionales verificados, precio claro y reserva en minutos',
    'Limpieza',
  ),
  slide(
    'hogar-mantenimiento',
    'Clima, plomería y más en un solo lugar',
    'Técnicos capacitados para resolver antes de que empeore',
    'Mantenimiento',
    require('../../assets/client-hero-hogar-promo.jpg'),
    0.32,
  ),
  slide(
    'hogar-vida',
    'Cuidado para tu familia y tus espacios',
    'Jardinería, mascotas y mandados con seguimiento en la app',
    'Hogar & mascotas',
  ),
];

/** Slides — tab Para tu Negocio. */
export const CLIENT_EMPRESA_HERO_SLIDES: ClientHeroSlide[] = [
  slide(
    'empresa-operativo',
    'Personal operativo cuando lo necesitás',
    'Cubrí picos de demanda sin contratos largos ni fricción',
    'Operativo',
  ),
  slide(
    'empresa-limpieza',
    'Limpieza y conserjería para tu negocio',
    'Equipos confiables para oficinas, locales y áreas comunes',
    'Institucional',
  ),
  slide(
    'empresa-eventos',
    'Meseros, cocina y apoyo en eventos',
    'Contratá por horas o jornada según tu operación del día',
    'Servicio',
  ),
];
