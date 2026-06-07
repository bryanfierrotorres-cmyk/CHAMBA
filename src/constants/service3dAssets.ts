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
  limpieza: require('../../assets/services-3d/limpieza.png'),
  car: require('../../assets/services-3d/car_wash.png'),
  ac: require('../../assets/services-3d/ac.png'),
  jardineria: require('../../assets/services-3d/jardineria.png'),
  pet: require('../../assets/services-3d/mascotas.png'),
  mandados: require('../../assets/services-3d/mandados.png'),
};

export function getService3dAsset(tileId: string): ImageSourcePropType | null {
  if (tileId in SERVICE_3D_ASSETS) {
    return SERVICE_3D_ASSETS[tileId as Service3dTileId];
  }
  return null;
}

export function hasService3dAsset(tileId: string): boolean {
  return tileId in SERVICE_3D_ASSETS;
}
