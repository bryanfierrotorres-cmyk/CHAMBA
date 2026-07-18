import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  Easing,
  StyleSheet,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
import { HOME_PALETTE, HOME_CARD_SHADOW } from '@constants/clientHomeTheme';

/** Punto verde con pulso (radar ping) — mismo patrón que el anillo de WhatsAppBubble. */
const PulseDot: React.FC = () => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotGhost, { opacity, transform: [{ scale }] }]} />
      <View style={styles.availableBadgeDot} />
    </View>
  );
};

export interface ServiceCardProps {
  title: string;
  footer: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Foto real del servicio — ~54% de la tarjeta (proporción de la referencia). */
  photoSource?: ImageSourcePropType | null;
  /** Descripción corta bajo el título (ej. "Hogares y oficinas"). */
  description?: string;
  /** Ícono vectorial pequeño al lado del título. */
  icon?: keyof typeof Ionicons.glyphMap;
  isCategory?: boolean;
  /** Badge verde superior ("Disponible hoy"). */
  availableBadge?: string;
}

/**
 * Tarjeta del grid "Servicios Express" — clon proporcional de la referencia
 * v1.3: foto arriba (~54%), fila [chip pequeño | título+subtítulo], footer
 * precio (azul) + "Ver opciones →" (gris) alineados en una sola línea.
 */
export const ServiceCard: React.FC<ServiceCardProps> = ({
  title,
  footer,
  onPress,
  style,
  photoSource,
  description,
  icon,
  isCategory = false,
  availableBadge,
}) => (
  <ChambaPressable style={[styles.card, style]} onPress={onPress} pressScale={0.97}>
    <View style={styles.photoWrap}>
      {photoSource ? (
        <Image source={photoSource} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.photo, styles.photoFallback]} />
      )}
      {!!availableBadge && (
        <View style={styles.availableBadge}>
          <Text style={styles.availableBadgeText}>{availableBadge}</Text>
          <PulseDot />
        </View>
      )}
    </View>

    <View style={styles.body}>
      <View style={styles.infoRow}>
        {!!icon && (
          <View style={styles.iconChip}>
            <Ionicons name={icon} size={12} color={HOME_PALETTE.blue} />
          </View>
        )}
        <View style={styles.infoCol}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!description && (
            <Text style={styles.description} numberOfLines={1}>{description}</Text>
          )}
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.priceFooter} numberOfLines={1}>{footer}</Text>
        <View style={styles.optionsLinkRow}>
          <Text style={styles.optionsLink} numberOfLines={1}>
            {isCategory ? 'Ver opciones' : 'Solicitar'}
          </Text>
          <Ionicons name="arrow-forward" size={10} color={HOME_PALETTE.midGray} />
        </View>
      </View>
    </View>
  </ChambaPressable>
);

const styles = StyleSheet.create({
  card: {
    height: 162,
    backgroundColor: HOME_PALETTE.card,
    borderRadius: 20,
    overflow: 'hidden',
    ...HOME_CARD_SHADOW,
  },
  photoWrap: {
    width: '100%',
    height: 86,
    position: 'relative',
    backgroundColor: HOME_PALETTE.lightGray,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    backgroundColor: HOME_PALETTE.lightGray,
  },
  availableBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 19,
    backgroundColor: HOME_PALETTE.greenLight,
    borderRadius: 999,
    paddingHorizontal: 8,
  },
  dotWrap: {
    width: 6,
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotGhost: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: HOME_PALETTE.green,
  },
  availableBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: HOME_PALETTE.green,
  },
  availableBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: HOME_PALETTE.greenDark,
  },
  body: {
    flex: 1,
    paddingTop: 9,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconChip: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: HOME_PALETTE.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: HOME_PALETTE.darkGray,
    letterSpacing: -0.1,
  },
  description: {
    fontSize: 10,
    fontWeight: '400',
    color: HOME_PALETTE.midGray,
    marginTop: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    gap: 4,
  },
  priceFooter: {
    fontSize: 11.5,
    fontWeight: '700',
    color: HOME_PALETTE.blue,
    flexShrink: 1,
  },
  optionsLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  optionsLink: {
    fontSize: 10,
    fontWeight: '500',
    color: HOME_PALETTE.midGray,
  },
});
