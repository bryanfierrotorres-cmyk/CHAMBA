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

/** Tamaño del cuadro 3D por categoría (default 128px). */
const SERVICE_3D_IMAGE_SIZES: Partial<Record<Service3dTileId, number>> = {
  limpieza: 135,
  ac: 154,
  jardineria: 96,
};

const DEFAULT_3D_IMAGE_SIZE = 128;

export function getService3dAsset(tileId: string): ImageSourcePropType | null {
  if (tileId in SERVICE_3D_ASSETS) {
    return SERVICE_3D_ASSETS[tileId as Service3dTileId];
  }
  return null;
}

export function getService3dImageSize(tileId: string): number {
  if (tileId in SERVICE_3D_IMAGE_SIZES) {
    return SERVICE_3D_IMAGE_SIZES[tileId as Service3dTileId]!;
  }
  return DEFAULT_3D_IMAGE_SIZE;
}

export function hasService3dAsset(tileId: string): boolean {
  return tileId in SERVICE_3D_ASSETS;
}
