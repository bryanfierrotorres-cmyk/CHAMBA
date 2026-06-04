/**
 * Fotos para el home del cliente.
 * Solo URLs verificadas (HTTP 200). Formato simple ?w= para máxima compatibilidad web.
 */

const u = (photoId: string, w = 600) =>
  `https://images.unsplash.com/${photoId}?w=${w}&q=80`;

/** Banner “Expertos listos para ayudarte” — saludo de confianza entre profesionales. */
export const CLIENT_HOGAR_HERO_IMAGE = u(
  'photo-1521791136064-7986c2920216',
  900,
);

/** Banner tab Para tu Negocio — personal operativo / carga. */
export const CLIENT_EMPRESA_HERO_IMAGE = u(
  'photo-1586528116311-ad8dd3c8310d',
  900,
);

/** Banner submenú Car Wash — técnico lavando vehículo. */
export const CLIENT_VEHICULOS_HERO_IMAGE = u(
  'photo-1773169206121-52cb503de27e',
  900,
);

/** Imágenes para carrusel y tiles principales Servicios Express. */
export const EXPRESS_MAIN_SERVICE_IMAGES: Record<string, string> = {
  limpieza: u('photo-1581578731548-c64695cc6952'),
  car:      u('photo-1549317661-bd32c8ce0db2'),
  ac:       u('photo-1600585154340-be6161a56a0c'),
  grama:    u('photo-1558904541-efa843a96f01'),
  pet:      u('photo-1583337130417-3346a1be7dee'),
  mandados: u('photo-1527515637462-cff94eecc1ac'),
};
