import {
  CLIENT_EMPRESA_HERO_IMAGE,
  CLIENT_HOGAR_HERO_IMAGE,
  CLIENT_VEHICULOS_HERO_IMAGE,
  EXPRESS_MAIN_SERVICE_IMAGES,
} from '@constants/clientHomeImages';

export interface ClientHeroSlide {
  id: string;
  imageUri: string;
  title: string;
  subtitle: string;
}

/** Mensajes rotativos — tab Para tu Hogar. */
export const CLIENT_HOGAR_HERO_SLIDES: ClientHeroSlide[] = [
  {
    id: 'expertos',
    imageUri: CLIENT_HOGAR_HERO_IMAGE,
    title: 'Expertos listos para ayudarte',
    subtitle: 'Garantía Chamba en cada servicio que contratás',
  },
  {
    id: 'express',
    imageUri: EXPRESS_MAIN_SERVICE_IMAGES.limpieza,
    title: 'Servicios Express con precio fijo',
    subtitle: 'Reservá en minutos, sin sorpresas en el cobro',
  },
  {
    id: 'verificados',
    imageUri: EXPRESS_MAIN_SERVICE_IMAGES.ac,
    title: 'Técnicos verificados en Managua',
    subtitle: 'Perfiles revisados antes de llegar a tu hogar',
  },
  {
    id: 'rapido',
    imageUri: CLIENT_VEHICULOS_HERO_IMAGE,
    title: 'Respuesta rápida el mismo día',
    subtitle: 'Seguimiento en tiempo real desde Mis Solicitudes',
  },
];

/** Mensajes rotativos — tab Para tu Negocio. */
export const CLIENT_EMPRESA_HERO_SLIDES: ClientHeroSlide[] = [
  {
    id: 'demanda',
    imageUri: CLIENT_EMPRESA_HERO_IMAGE,
    title: 'Personal bajo demanda para tu negocio',
    subtitle: 'Cubrí picos de trabajo sin contratos largos',
  },
  {
    id: 'modalidad',
    imageUri: EXPRESS_MAIN_SERVICE_IMAGES.mandados,
    title: 'Por horas o por jornadas completas',
    subtitle: 'Elegí la modalidad que mejor se adapte a tu operación',
  },
  {
    id: 'capacitado',
    imageUri: EXPRESS_MAIN_SERVICE_IMAGES.limpieza,
    title: 'Personal capacitado y supervisado',
    subtitle: 'Conserjes, cocina, meseros y apoyo operativo',
  },
  {
    id: 'premium',
    imageUri: EXPRESS_MAIN_SERVICE_IMAGES.car,
    title: 'Servicios Premium para empresas',
    subtitle: 'Fumigación, alfombras institucionales y más',
  },
];
