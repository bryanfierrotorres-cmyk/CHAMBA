import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
import { CHAMBA, chambaStyles } from '@constants/chambaUI';

const DEEP_BLUE = '#1E293B';
/** Tamaño estándar del avatar 3D en tarjetas Express. */
export const SERVICE_CARD_IMAGE_SIZE = 128;
/** Tamaño compacto (p. ej. jardinería — composición ya equilibrada). */
export const SERVICE_CARD_IMAGE_SIZE_COMPACT = 96;

export interface ServiceCardProps {
  title: string;
  footer: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Avatar 3D local (prioridad sobre icono vectorial). */
  imageSource?: ImageSourcePropType | null;
  /** Side del cuadro 3D; default 128px. */
  imageSize?: number;
  /** Fallback vectorial para subcategorías sin asset 3D. */
  icon?: React.ReactNode;
  iconColor?: string;
  isCategory?: boolean;
}

/**
 * Tarjeta claymorphism para el grid de servicios del home cliente.
 */
export const ServiceCard: React.FC<ServiceCardProps> = ({
  title,
  footer,
  onPress,
  style,
  imageSource,
  imageSize = SERVICE_CARD_IMAGE_SIZE,
  icon,
  iconColor = '#E2E8F0',
  isCategory = false,
}) => (
  <ChambaPressable
    style={[styles.card, style]}
    onPress={onPress}
    pressScale={0.97}
  >
    {imageSource ? (
      <View
        style={[
          styles.imageWrap,
          { width: imageSize, height: imageSize, backgroundColor: 'transparent' },
        ]}
      >
        <Image
          source={imageSource}
          style={{
            width: imageSize,
            height: imageSize,
            backgroundColor: 'transparent',
          }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    ) : icon ? (
      <View style={[styles.iconWrap, { backgroundColor: iconColor }]}>
        {icon}
      </View>
    ) : null}

    <View style={styles.textBlock}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      {isCategory ? (
        <Text style={styles.categoryFooter} numberOfLines={1}>
          {footer}
        </Text>
      ) : (
        <Text style={[chambaStyles.priceLine, styles.priceFooter]} numberOfLines={1}>
          {footer}
        </Text>
      )}
    </View>
  </ChambaPressable>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 22,
    padding: 12,
    alignItems: 'center',
    minHeight: 196,
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  textBlock: {
    width: '100%',
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: DEEP_BLUE,
    textAlign: 'center',
    lineHeight: 20,
    minHeight: 40,
    width: '100%',
    letterSpacing: -0.2,
  },
  priceFooter: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  categoryFooter: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: CHAMBA.muted,
    textAlign: 'center',
  },
});
