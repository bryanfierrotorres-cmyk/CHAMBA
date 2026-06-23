import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  type ImageResizeMode,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCurrency } from '@utils/formatters';
import { getConfiguredServiceSeed } from '@constants/servicesConfig';
import { renderExpressTileIcon } from '@constants/clientHomeServiceIcons';
import { getSubcategoryIconColor } from '@constants/chambaUI';
import { getService3dAsset } from '@constants/service3dAssets';
import { EXPRESS_SUBMENU_META } from '@constants/clientHomeExpress';
import type { ExpressSubmenu } from '@constants/servicesConfig';
import type { ExpressTileDef } from '@constants/clientHomeExpress';
import type { ServiceType } from '@features/catalog/types';
import {
  PREMIUM_FIRE,
  PREMIUM_MUTED,
  SERVICE_ROW_THUMB_SIZE,
  premiumSubcategoryStyles as styles,
} from './premiumSubcategoryList.styles';

export { SERVICE_LIST_BOTTOM_PAD } from './premiumSubcategoryList.styles';

export interface PremiumSubcategoryListProps {
  tiles: ExpressTileDef[];
  submenu: ExpressSubmenu;
  serviceTypes: ServiceType[];
  getSuggestedPrice: (slug: string, fallback?: number) => number;
  onTilePress: (tile: ExpressTileDef) => void;
  /** Padding extra bajo la última tarjeta (tab bar + Ayuda). */
  listBottomPadding?: number;
}

/** Minutos estimados por slug (fallback 45 min). */
const ESTIMATED_MINUTES_BY_SLUG: Record<string, number> = {
  vehiculo_lavado_regular: 30,
  vehiculo_limpieza_profunda: 60,
  vehiculo_aceite_filtro: 45,
  vehiculo_pulido_pasteado: 50,
  limpieza_sofas: 90,
  limpieza_banos: 45,
  limpieza_alfombra: 60,
  conserjeria_ocasional: 120,
  jardineria_corte: 40,
  jardineria_poda: 50,
  jardineria_patio: 55,
  jardineria: 45,
  ac_limpieza_filtros: 35,
  ac_mantenimiento: 50,
  ac_revision: 60,
  ac_recarga: 40,
  pet_bano: 35,
  pet_paseo: 30,
  pet_grooming: 50,
  pet_personalizado: 45,
};

interface ServiceRowFicha {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  estimatedMinutes: number;
  techniciansNearby: number;
  imageSource: ImageSourcePropType | null;
  imageResizeMode: ImageResizeMode;
  iconColor: string;
  icon: React.ReactNode;
  onPress: () => void;
}

const stableTechniciansNearby = (slug: string): number => {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash + slug.charCodeAt(i) * (i + 3)) % 23;
  }
  return 8 + hash;
};

const resolveEstimatedMinutes = (slug: string): number =>
  ESTIMATED_MINUTES_BY_SLUG[slug] ?? 45;

const resolveDescription = (
  slug: string,
  serviceTypes: ServiceType[],
): string => {
  const fromCatalog = serviceTypes.find((t) => t.slug === slug)?.description;
  if (fromCatalog?.trim()) return fromCatalog.trim();
  const seed = getConfiguredServiceSeed(slug);
  if (seed?.description?.trim()) return seed.description.trim();
  return 'Servicio a domicilio con técnicos verificados';
};

/** Imagen 3D / URL remota del catálogo; fallback al icono de la categoría padre. */
const resolveTileImageSource = (
  tile: ExpressTileDef,
  submenu: ExpressSubmenu,
  serviceTypes: ServiceType[],
): ImageSourcePropType | null => {
  if (tile.slug) {
    const remoteUrl = serviceTypes.find((t) => t.slug === tile.slug)?.image_url?.trim();
    if (remoteUrl) return { uri: remoteUrl };
  }

  const local = getService3dAsset(tile.id);
  if (local) return local;

  const parentId = EXPRESS_SUBMENU_META[submenu]?.parentTileId;
  if (parentId) return getService3dAsset(parentId);

  return null;
};

const ServiceRowThumb: React.FC<{
  imageSource: ImageSourcePropType | null;
  resizeMode: ImageResizeMode;
  iconColor: string;
  icon: React.ReactNode;
}> = ({ imageSource, resizeMode, iconColor, icon }) => {
  if (imageSource) {
    return (
      <View style={styles.thumbWrap}>
        <Image
          source={imageSource}
          style={styles.thumbImage}
          resizeMode={resizeMode}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <View style={[styles.iconFallback, { backgroundColor: iconColor }]}>
      {icon}
    </View>
  );
};

export const PremiumSubcategoryList: React.FC<PremiumSubcategoryListProps> = ({
  tiles,
  submenu,
  serviceTypes,
  getSuggestedPrice,
  onTilePress,
  listBottomPadding,
}) => {
  const fichas = useMemo((): ServiceRowFicha[] => {
    return tiles
      .filter((tile) => !!tile.slug)
      .map((tile, index) => {
        const slug = tile.slug!;
        
        if (slug === 'virtual_custom') {
          return {
            id: tile.id,
            title: tile.title,
            description: 'Describe tu necesidad y te daremos una cotización a la medida.',
            priceLabel: 'Cotizar',
            estimatedMinutes: 60,
            techniciansNearby: 15,
            imageSource: null,
            imageResizeMode: 'contain',
            iconColor: '#0F172A',
            icon: <Text style={{ fontSize: 22 }}>✨</Text>,
            onPress: () => onTilePress(tile),
          };
        }

        const price = getSuggestedPrice(slug, tile.fallbackPrice ?? 0);
        const imageSource = resolveTileImageSource(tile, submenu, serviceTypes);
        const imageResizeMode: ImageResizeMode =
          typeof imageSource === 'object' &&
          imageSource !== null &&
          !Array.isArray(imageSource) &&
          'uri' in imageSource
            ? 'cover'
            : 'contain';

        return {
          id: tile.id,
          title: tile.title,
          description: resolveDescription(slug, serviceTypes),
          priceLabel: formatCurrency(price),
          estimatedMinutes: resolveEstimatedMinutes(slug),
          techniciansNearby: stableTechniciansNearby(slug),
          imageSource,
          imageResizeMode,
          iconColor: getSubcategoryIconColor(index),
          icon: renderExpressTileIcon(tile.id, submenu),
          onPress: () => onTilePress(tile),
        };
      });
  }, [tiles, submenu, serviceTypes, getSuggestedPrice, onTilePress]);

  return (
    <View
      style={[
        styles.list,
        listBottomPadding != null ? { paddingBottom: listBottomPadding } : null,
      ]}
    >
      {fichas.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardTop}>
            <ServiceRowThumb
              imageSource={item.imageSource}
              resizeMode={item.imageResizeMode}
              iconColor={item.iconColor}
              icon={item.icon}
            />

            <View style={styles.cardBody}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.indicatorsRow}>
                <View style={styles.indicator}>
                  <Ionicons name="time-outline" size={14} color={PREMIUM_MUTED} />
                  <Text style={styles.indicatorText}>{item.estimatedMinutes} min</Text>
                </View>
                <View style={styles.indicator}>
                  <MaterialCommunityIcons name="fire" size={14} color={PREMIUM_FIRE} />
                  <Text style={styles.indicatorText}>
                    {item.techniciansNearby} técnicos cerca
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.cardFooter}>
            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>Precio sugerido</Text>
              <Text style={styles.priceValue}>{item.priceLabel}</Text>
            </View>

            <Pressable
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={`Subastar ${item.title}`}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Text style={styles.actionBtnText}>Subastar</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
};
