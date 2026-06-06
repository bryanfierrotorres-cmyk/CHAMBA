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
const IMAGE_SIZE = 80;

export interface ServiceCardProps {
  title: string;
  footer: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Avatar 3D local (prioridad sobre icono vectorial). */
  imageSource?: ImageSourcePropType | null;
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
      <View style={styles.imageWrap}>
        <Image
          source={imageSource}
          style={styles.image3d}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    ) : icon ? (
      <View style={[styles.iconWrap, { backgroundColor: iconColor }]}>
        {icon}
      </View>
    ) : null}

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
  </ChambaPressable>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 168,
    justifyContent: 'flex-start',
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
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  image3d: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
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
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  categoryFooter: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: CHAMBA.muted,
    textAlign: 'center',
  },
});
