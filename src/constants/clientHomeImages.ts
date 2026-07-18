/**
 * Fotos del banner reel (Home cliente) y tiles Express.
 * Cada slide tiene URL principal + respaldo (picsum) si Unsplash no carga en web.
 */

export interface HeroSlideImageSet {
  primary: string;
  fallback: string;
}

const unsplash = (photoId: string, w = 1200) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&h=700&q=85`;

/** Respaldo estable por id de slide (siempre disponible). */
const picsumSeed = (seed: string) =>
  `https://picsum.photos/seed/chamba-${seed}/1200/700`;

/** Carrusel Home — primary + fallback por slide.id */
export const CLIENT_HERO_SLIDE_IMAGES: Record<string, HeroSlideImageSet> = {
  'hogar-promo-segundo-servicio': {
    primary: unsplash('photo-1519085360753-af0119f7cbe7'),
    fallback: picsumSeed('hogar-promo'),
  },
  'hogar-limpieza': {
    primary: unsplash('photo-1581578731548-c64695cc6952'),
    fallback: picsumSeed('hogar-limpieza'),
  },
  'hogar-mantenimiento': {
    primary: unsplash('photo-1621961458348-f013d219b50c'),
    fallback: picsumSeed('hogar-ac'),
  },
  'hogar-vida': {
    primary: unsplash('photo-1583337130417-3346a1be7dee'),
    fallback: picsumSeed('hogar-mascotas'),
  },
  'empresa-operativo': {
    primary: unsplash('photo-1586528116311-ad8dd3c8310d'),
    fallback: picsumSeed('empresa-operativo'),
  },
  'empresa-limpieza': {
    primary: unsplash('photo-1497366811353-973a0fcf0ca0'),
    fallback: picsumSeed('empresa-limpieza'),
  },
  'empresa-eventos': {
    primary: unsplash('photo-1414235077428-3389899a2718'),
    fallback: picsumSeed('empresa-eventos'),
  },
};

const DEFAULT_HERO_IMAGES: HeroSlideImageSet = {
  primary: unsplash('photo-1521791136064-7986c2920216'),
  fallback: picsumSeed('default'),
};

export const getHeroSlideImages = (slideId: string): HeroSlideImageSet =>
  CLIENT_HERO_SLIDE_IMAGES[slideId] ?? DEFAULT_HERO_IMAGES;

/** @deprecated Usar getHeroSlideImages */
export const CLIENT_HOGAR_HERO_IMAGE = CLIENT_HERO_SLIDE_IMAGES['hogar-limpieza'].primary;
export const CLIENT_EMPRESA_HERO_IMAGE = CLIENT_HERO_SLIDE_IMAGES['empresa-operativo'].primary;

const expressU = (photoId: string) => unsplash(photoId, 640);

/** Imágenes para tiles principales Servicios Express. */
export const EXPRESS_MAIN_SERVICE_IMAGES: Record<string, string> = {
  limpieza: expressU('photo-1581578731548-c64695cc6952'),
  car:      expressU('photo-1549317661-bd32c8ce0db2'),
  ac:       expressU('photo-1621961458348-f013d219b50c'),
  jardineria: expressU('photo-1558904541-efa843a96f01'),
  grama:      expressU('photo-1558904541-efa843a96f01'),
  pet:      expressU('photo-1583337130417-3346a1be7dee'),
  mandados: expressU('photo-1527515637462-cff94eecc1ac'),
};
