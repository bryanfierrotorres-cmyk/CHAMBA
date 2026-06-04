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
  placeholderLabel?: string;
}

const slide = (
  id: string,
  title: string,
  subtitle: string,
  placeholderLabel?: string,
): ClientHeroSlide => {
  const imgs = getHeroSlideImages(id);
  return {
    id,
    title,
    subtitle,
    imageUri: imgs.primary,
    imageFallbackUri: imgs.fallback,
    placeholderLabel,
  };
};

/** Slides — tab Para tu Hogar. */
export const CLIENT_HOGAR_HERO_SLIDES: ClientHeroSlide[] = [
  slide(
    'hogar-promo-segundo-servicio',
    'Ahorra en tu próximo servicio',
    'Obtén un 15% de descuento al realizar tu segundo servicio con nosotros.',
    'Promoción',
  ),
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
