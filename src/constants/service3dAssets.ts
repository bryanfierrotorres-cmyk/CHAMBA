import type { ImageSourcePropType } from 'react-native';

/** IDs de tiles principales Express (home cliente). */
export type Service3dTileId =
  | 'limpieza'
  | 'car'
  | 'ac'
  | 'jardineria'
  | 'pet'
  | 'mandados';

const SERVICE_3D_ASSETS: Record<Service3dTileId, ImageSourcePropType> = {
  limpieza: require('../../assets/services-3d/limpieza_cuidado.png'),
  car: require('../../assets/services-3d/car_wash_cuidado.png'),
  ac: require('../../assets/services-3d/ac_mantenimiento.png'),
  jardineria: require('../../assets/services-3d/jardineria_cuidado.png'),
  pet: require('../../assets/services-3d/mascotas_cuidado.png'),
  mandados: require('../../assets/services-3d/mandados.png'),
};

/** Tamaño y posición del render 3D por categoría (sin editar el PNG). */
export interface Service3dImageLayout {
  size: number;
  /** Desplaza la imagen hacia abajo dentro de la ficha (px). */
  offsetY?: number;
}

const SERVICE_3D_LAYOUT: Partial<Record<Service3dTileId, Service3dImageLayout>> = {
  limpieza: { size: 135 },
  ac: { size: 154 },
  car: { size: 153, offsetY: 14 },
  jardineria: { size: 124, offsetY: 24 },
  mandados: { size: 158 },
};

const DEFAULT_3D_IMAGE_SIZE = 128;

export function getService3dAsset(tileId: string): ImageSourcePropType | null {
  if (tileId in SERVICE_3D_ASSETS) {
    return SERVICE_3D_ASSETS[tileId as Service3dTileId];
  }
  return null;
}

export function getService3dImageSize(tileId: string): number {
  return SERVICE_3D_LAYOUT[tileId as Service3dTileId]?.size ?? DEFAULT_3D_IMAGE_SIZE;
}

export function getService3dImageOffsetY(tileId: string): number {
  return SERVICE_3D_LAYOUT[tileId as Service3dTileId]?.offsetY ?? 0;
}

export function hasService3dAsset(tileId: string): boolean {
  return tileId in SERVICE_3D_ASSETS;
}
