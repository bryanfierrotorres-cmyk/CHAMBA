import type { ServiceType } from '@features/catalog/types';

/** 
 * Diccionario de sinónimos para términos comunes en Nicaragua.
 * Mapea la palabra clave escrita por el usuario al slug del servicio.
 */
export const SYNONYM_MAP: Record<string, string[]> = {
  // Plomería
  fuga: ['plomeria', 'reparacion_tuberia'],
  tubo: ['plomeria'],
  tuberia: ['plomeria'],
  chorro: ['plomeria'],
  inodoro: ['plomeria'],
  lavabo: ['plomeria'],
  grifo: ['plomeria'],
  agua: ['plomeria'],
  
  // Jardinería
  zacate: ['jardineria'],
  monte: ['jardineria'],
  grama: ['jardineria'],
  poda: ['jardineria_poda'],
  arbol: ['jardineria_poda'],
  cesped: ['jardineria'],
  patio: ['jardineria_patio'],

  // Electricidad
  luz: ['electricidad'],
  chispa: ['electricidad'],
  corto: ['electricidad'],
  cortocircuito: ['electricidad'],
  enchufe: ['electricidad'],
  cable: ['electricidad'],
  tomacorriente: ['electricidad'],
  abanico: ['electricidad', 'electrodomesticos'],

  // Limpieza
  aseo: ['limpieza', 'conserjeria_ocasional'],
  barrer: ['conserjeria_ocasional'],
  trapear: ['conserjeria_ocasional'],
  sucia: ['conserjeria_ocasional', 'vehiculo_limpieza_profunda', 'limpieza_sofas', 'limpieza_alfombra'],
  sucio: ['conserjeria_ocasional', 'vehiculo_limpieza_profunda', 'limpieza_sofas', 'limpieza_alfombra'],
  polvo: ['conserjeria_ocasional', 'limpieza_sofas', 'limpieza_alfombra'],

  // AC / Climatización
  ac: ['climatizacion', 'ac_limpieza_filtros', 'ac_reparacion'],
  aire: ['climatizacion', 'ac_limpieza_filtros', 'ac_reparacion'],
  acondicionado: ['climatizacion', 'ac_limpieza_filtros', 'ac_reparacion'],
  helado: ['climatizacion', 'ac_reparacion'],
  enfria: ['climatizacion', 'ac_reparacion'],
  congelado: ['climatizacion', 'ac_reparacion'],

  // Fumigación
  cucarachas: ['fumigacion'],
  ratones: ['fumigacion'],
  zancudos: ['fumigacion'],
  bichos: ['fumigacion'],
  insectos: ['fumigacion'],
  plaga: ['fumigacion'],
};

/**
 * Normaliza el texto removiendo acentos y convirtiéndolo a minúsculas.
 */
export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Busca servicios que coincidan con la búsqueda, ya sea por nombre directo, 
 * descripción, o por el diccionario de sinónimos.
 */
export const searchServices = (
  query: string,
  serviceTypes: ServiceType[]
): ServiceType[] => {
  const normalizedQuery = normalizeText(query.trim());
  if (!normalizedQuery) return [];

  const matchedSlugs = new Set<string>();

  // 1. Buscar en sinónimos (si alguna palabra clave incluye la búsqueda o viceversa)
  const queryWords = normalizedQuery.split(/\s+/);
  
  for (const [synonym, slugs] of Object.entries(SYNONYM_MAP)) {
    const normalizedSynonym = normalizeText(synonym);
    // Si la palabra clave es parte de la búsqueda, o la búsqueda es parte de la palabra clave
    if (
      queryWords.some((word) => normalizedSynonym.includes(word) || word.includes(normalizedSynonym))
    ) {
      slugs.forEach((slug) => matchedSlugs.add(slug));
    }
  }

  // 2. Filtrar el catálogo
  const results = serviceTypes.filter((service) => {
    // Coincidencia directa en nombre o descripción
    const matchName = normalizeText(service.name).includes(normalizedQuery);
    const matchDesc = service.description ? normalizeText(service.description).includes(normalizedQuery) : false;
    // Coincidencia por categoría madre
    const matchCat = normalizeText(service.category_slug).includes(normalizedQuery);
    // Coincidencia por sinónimo
    const matchSynonym = matchedSlugs.has(service.slug) || matchedSlugs.has(service.category_slug);

    return matchName || matchDesc || matchCat || matchSynonym;
  });

  // Retornar top 6 resultados para mantener la UI limpia
  return results.slice(0, 6);
};
