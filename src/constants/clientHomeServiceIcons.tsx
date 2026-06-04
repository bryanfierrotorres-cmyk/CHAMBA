/**
 * Iconos y colores de tarjetas de servicio en el home del cliente.
 */
import React from 'react';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import type { ExpressSubmenu } from '@constants/servicesConfig';
import { premiumIconBg } from '@constants/clientHomeExpress';

const WHITE = '#FFFFFF';
const SZ = 22;

/** Fondo del cuadrado de icono por id de tile o slug. */
export const getServiceIconBg = (tileId: string, slug?: string): string => {
  if (slug) return premiumIconBg(slug);
  return TILE_ICON_BG[tileId] ?? '#0284C7';
};

export const TILE_ICON_BG: Record<string, string> = {
  limpieza: '#3B82F6',
  car: '#0D9488',
  ac: '#06B6D4',
  grama: '#22C55E',
  pet: '#F97316',
  mandados: '#8B5CF6',
  sofas: '#8B5CF6',
  banos: '#0EA5E9',
  casa: '#14B8A6',
  alfombra: '#6366F1',
  regular: '#3B82F6',
  profunda: '#2563EB',
  aceite: '#64748B',
  pulido: '#7C3AED',
  corte: '#22C55E',
  poda: '#16A34A',
  patio: '#0D9488',
  riego: '#0284C7',
  filtros: '#06B6D4',
  preventivo: '#0891B2',
  revision: '#3B82F6',
  recarga: '#6366F1',
  bano: '#F97316',
  paseo: '#22C55E',
  grooming: '#EC4899',
  personalizado: '#8B5CF6',
  electricista: '#F59E0B',
  plomeria: '#0284C7',
  linea_blanca: '#6366F1',
};

export const renderExpressTileIcon = (
  tileId: string,
  submenu: ExpressSubmenu | null,
): React.ReactNode => {
  if (submenu) return renderSubmenuIcon(tileId, submenu);
  return renderMainIcon(tileId);
};

const renderMainIcon = (id: string): React.ReactNode => {
  switch (id) {
    case 'limpieza':
      return <MaterialCommunityIcons name="vacuum" size={SZ} color={WHITE} />;
    case 'car':
      return <Ionicons name="car-sport" size={SZ} color={WHITE} />;
    case 'ac':
      return <MaterialCommunityIcons name="air-conditioner" size={SZ} color={WHITE} />;
    case 'grama':
      return <Ionicons name="leaf" size={SZ} color={WHITE} />;
    case 'pet':
      return <FontAwesome5 name="dog" size={20} color={WHITE} />;
    case 'mandados':
      return <MaterialCommunityIcons name="bike-fast" size={SZ} color={WHITE} />;
    default:
      return <Ionicons name="sparkles" size={SZ} color={WHITE} />;
  }
};

const renderSubmenuIcon = (id: string, submenu: ExpressSubmenu): React.ReactNode => {
  switch (submenu) {
    case 'limpieza':
      switch (id) {
        case 'sofas':
          return <MaterialCommunityIcons name="sofa" size={SZ} color={WHITE} />;
        case 'banos':
          return <MaterialCommunityIcons name="shower" size={SZ} color={WHITE} />;
        case 'casa':
          return <MaterialCommunityIcons name="home" size={SZ} color={WHITE} />;
        case 'alfombra':
          return <MaterialCommunityIcons name="rug" size={SZ} color={WHITE} />;
        default:
          return <MaterialCommunityIcons name="vacuum" size={SZ} color={WHITE} />;
      }
    case 'vehiculos':
      switch (id) {
        case 'regular':
          return <Ionicons name="car-sport" size={SZ} color={WHITE} />;
        case 'profunda':
          return <MaterialCommunityIcons name="car-wash" size={SZ} color={WHITE} />;
        case 'aceite':
          return <MaterialCommunityIcons name="oil-level" size={SZ} color={WHITE} />;
        case 'pulido':
          return <MaterialCommunityIcons name="circle-opacity" size={SZ} color={WHITE} />;
        default:
          return <Ionicons name="car-sport" size={SZ} color={WHITE} />;
      }
    case 'jardineria':
      switch (id) {
        case 'corte':
          return <MaterialCommunityIcons name="grass" size={SZ} color={WHITE} />;
        case 'poda':
          return <MaterialCommunityIcons name="tree" size={SZ} color={WHITE} />;
        case 'patio':
          return <MaterialCommunityIcons name="home-outline" size={SZ} color={WHITE} />;
        case 'riego':
          return <Ionicons name="water" size={SZ} color={WHITE} />;
        default:
          return <Ionicons name="leaf" size={SZ} color={WHITE} />;
      }
    case 'ac':
      switch (id) {
        case 'filtros':
          return <MaterialCommunityIcons name="air-filter" size={SZ} color={WHITE} />;
        case 'preventivo':
          return <MaterialCommunityIcons name="wrench" size={SZ} color={WHITE} />;
        case 'revision':
          return <MaterialCommunityIcons name="clipboard-check-outline" size={SZ} color={WHITE} />;
        case 'recarga':
          return <MaterialCommunityIcons name="gas-cylinder" size={SZ} color={WHITE} />;
        default:
          return <MaterialCommunityIcons name="air-conditioner" size={SZ} color={WHITE} />;
      }
    case 'mascotas':
      switch (id) {
        case 'bano':
          return <MaterialCommunityIcons name="shower" size={SZ} color={WHITE} />;
        case 'paseo':
          return <FontAwesome5 name="walking" size={18} color={WHITE} />;
        case 'grooming':
          return <MaterialCommunityIcons name="content-cut" size={SZ} color={WHITE} />;
        case 'personalizado':
          return <MaterialCommunityIcons name="clipboard-text-outline" size={SZ} color={WHITE} />;
        default:
          return <FontAwesome5 name="dog" size={20} color={WHITE} />;
      }
    default:
      return renderMainIcon(id);
  }
};

export const renderSpecializedIcon = (id: string): React.ReactNode => {
  switch (id) {
    case 'electricista':
      return <Ionicons name="flash" size={SZ} color={WHITE} />;
    case 'plomeria':
      return <Ionicons name="water" size={SZ} color={WHITE} />;
    case 'linea_blanca':
      return <MaterialCommunityIcons name="fridge-outline" size={SZ} color={WHITE} />;
    default:
      return <Ionicons name="construct" size={SZ} color={WHITE} />;
  }
};

const SLUG_TO_EXPRESS_TILE: Record<string, string> = {
  limpieza_sofas: 'sofas',
  limpieza_banos: 'banos',
  conserjeria_ocasional: 'casa',
  limpieza_alfombra: 'alfombra',
  vehiculo_lavado_regular: 'regular',
  vehiculo_limpieza_profunda: 'profunda',
  vehiculo_aceite_filtro: 'aceite',
  vehiculo_pulido_pasteado: 'pulido',
  jardineria_corte: 'corte',
  jardineria_poda: 'poda',
  jardineria_patio: 'patio',
  jardineria: 'riego',
  ac_limpieza_filtros: 'filtros',
  ac_mantenimiento: 'preventivo',
  ac_revision: 'revision',
  ac_recarga: 'recarga',
  pet_bano: 'bano',
  pet_paseo: 'paseo',
  pet_grooming: 'grooming',
  pet_personalizado: 'personalizado',
  mandados_express: 'mandados',
};

/** Icono premium para el formulario de solicitud y otras pantallas por slug. */
export const renderServiceIconBySlug = (slug: string): React.ReactNode => {
  if (slug === 'electricista' || slug === 'plomeria' || slug === 'linea_blanca') {
    return renderSpecializedIcon(slug);
  }
  if (
    slug.startsWith('b2b_') ||
    slug.startsWith('vehiculo_') ||
    slug === 'conserjeria_contrato' ||
    slug === 'alfombra_institucional' ||
    slug === 'fumigacion'
  ) {
    return renderEmpresaServiceIcon(slug);
  }
  const tileId = SLUG_TO_EXPRESS_TILE[slug] ?? slug;
  return renderExpressTileIcon(tileId, null);
};

export const renderEmpresaServiceIcon = (slug: string): React.ReactNode => {
  switch (slug) {
    case 'vehiculo_profundo':
    case 'vehiculo_lavado_regular':
    case 'vehiculo_limpieza_profunda':
      return <Ionicons name="car-sport" size={SZ} color={WHITE} />;
    case 'alfombra_institucional':
    case 'b2b_conserje_empresa':
      return <MaterialCommunityIcons name="vacuum" size={SZ} color={WHITE} />;
    case 'conserjeria_contrato':
    case 'b2b_mesero_barman':
      return <MaterialCommunityIcons name="account-group" size={SZ} color={WHITE} />;
    case 'b2b_ayudante_cocina':
      return <MaterialCommunityIcons name="chef-hat" size={SZ} color={WHITE} />;
    case 'b2b_personal_operativo':
      return <MaterialCommunityIcons name="package-variant" size={SZ} color={WHITE} />;
    case 'fumigacion':
      return <MaterialCommunityIcons name="bug" size={SZ} color={WHITE} />;
    case 'b2b_apoyo_hogar':
      return <MaterialCommunityIcons name="home-account" size={SZ} color={WHITE} />;
    default:
      return <MaterialCommunityIcons name="briefcase-outline" size={SZ} color={WHITE} />;
  }
};
