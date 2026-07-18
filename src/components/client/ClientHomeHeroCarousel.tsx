import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ImageStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';
import { HOME_PALETTE, HOME_SOFT_SHADOW } from '@constants/clientHomeTheme';
import type { ClientHeroSlide } from '@constants/clientHomeHeroSlides';

const BANNER_HEIGHT = 196;
const AUTO_ADVANCE_MS = 4500;
const HORIZONTAL_PAD = 0;
const PROMO_SLIDE_ID = 'hogar-promo-segundo-servicio';
/** ~5 cm hacia arriba en el banner promocional (foto local). */
const PROMO_PHOTO_LIFT_PX = 52;

interface HeroSlidePhotoProps {
  slide: ClientHeroSlide;
}

const getPhotoStyle = (slide: ClientHeroSlide): ImageStyle[] => {
  const base: ImageStyle[] = [styles.photo];

  const isPromoPhoto = slide.imageLocal != null && slide.id === PROMO_SLIDE_ID;
  if (isPromoPhoto) {
    base.push({
      height: BANNER_HEIGHT + PROMO_PHOTO_LIFT_PX,
      top: -PROMO_PHOTO_LIFT_PX,
      ...(Platform.OS === 'web'
        ? ({
            objectFit: 'cover',
            objectPosition: 'center 18%',
          } as ImageStyle)
        : {}),
    });
    return base;
  }

  if (slide.imageFocusY != null && Platform.OS === 'web') {
    base.push({
      objectFit: 'cover',
      objectPosition: `center ${Math.round(slide.imageFocusY * 100)}%`,
    } as ImageStyle);
  }

  return base;
};

/** Foto con respaldo si la URL principal no carga (común en web con Unsplash). */
const HeroSlidePhoto: React.FC<HeroSlidePhotoProps> = ({ slide }) => {
  const [uri, setUri] = useState(slide.imageUri);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setUri(slide.imageUri);
    setExhausted(false);
  }, [slide.id, slide.imageUri]);

  if (slide.imageLocal) {
    return (
      <Image
        source={slide.imageLocal}
        style={getPhotoStyle(slide)}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  const onError = () => {
    if (slide.imageFallbackUri && uri !== slide.imageFallbackUri) {
      setUri(slide.imageFallbackUri);
      return;
    }
    setExhausted(true);
  };

  if (exhausted || !uri) {
    return (
      <View style={[styles.placeholder, exhausted && styles.placeholderFailed]}>
        <Ionicons name="image-outline" size={36} color="#94A3B8" />
        {slide.placeholderLabel ? (
          <Text style={styles.placeholderLabel}>{slide.placeholderLabel}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={getPhotoStyle(slide)}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      onError={onError}
    />
  );
};

interface ClientHomeHeroCarouselProps {
  slides: ClientHeroSlide[];
  /** CTA del slide "Servicio Express" (banner claro, spec v1.0). */
  onExpressCtaPress?: () => void;
}

/**
 * Banner superior del Home — deslizador horizontal aislado.
 * No modifica ni depende de la grilla de categorías (Express, etc.).
 */
export const ClientHomeHeroCarousel: React.FC<ClientHomeHeroCarouselProps> = ({
  slides,
  onExpressCtaPress,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const slideWidth = screenWidth - 32;
  const listRef = useRef<FlatList<ClientHeroSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScrollEnd = useCallback(
    (e: any) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / slideWidth);
      if (next >= 0 && next < slides.length) setActiveIndex(next);
    },
    [slideWidth, slides.length],
  );

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length) return;
      listRef.current?.scrollToIndex({ index, animated: true });
      setActiveIndex(index);
    },
    [slides.length],
  );

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % slides.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const renderSlide = ({ item }: { item: ClientHeroSlide }) => {
    const isPromoSlide = item.id === PROMO_SLIDE_ID;

    if (item.isExpressSlide) {
      return (
        <View style={[styles.slideOuter, { width: slideWidth }]}>
          <LinearGradient
            colors={['#F8FBFF', '#EDF5FF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.expressCard}
          >
            <View style={styles.expressLeft}>
              {!!item.badge && (
                <View style={styles.expressBadge}>
                  <Text style={styles.expressBadgeText}>{item.badge.toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.expressTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.expressSubtitle} numberOfLines={2}>{item.subtitle}</Text>
              {!!item.ctaLabel && (
                <Pressable
                  style={styles.expressCta}
                  onPress={onExpressCtaPress}
                  accessibilityRole="button"
                >
                  <Text style={styles.expressCtaText}>{item.ctaLabel}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </Pressable>
              )}
            </View>

            <View style={styles.expressPhotoWrap}>
              <View style={styles.expressPhotoCircle} />
              <View style={styles.expressPhotoInner}>
                <HeroSlidePhoto slide={item} />
              </View>
              {!!item.timeBadge && (
                <View style={styles.expressTimeChip}>
                  <Ionicons name="time-outline" size={15} color={HOME_PALETTE.blue} style={styles.expressTimeChipIcon} />
                  <Text style={styles.expressTimeChipValue}>{item.timeBadge.split(' ')[0]}</Text>
                  <Text style={styles.expressTimeChipUnit}>{item.timeBadge.split(' ')[1]}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={[styles.slideOuter, { width: slideWidth }]}>
        <View style={styles.slideCard}>
          <View style={styles.imageLayer}>
            <HeroSlidePhoto slide={item} />
          </View>

          <View style={styles.textLayer}>
            <LinearGradient
              colors={
                isPromoSlide
                  ? ['transparent', 'transparent', 'rgba(0, 0, 0, 0.75)']
                  : ['transparent', 'rgba(15, 23, 42, 0.55)', 'rgba(15, 23, 42, 0.85)']
              }
              locations={isPromoSlide ? [0, 0.45, 1] : [0.35, 0.65, 1]}
              style={styles.overlay}
            >
              <Text style={styles.heroTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.heroSubtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
            </LinearGradient>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.bannerWrap}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={slideWidth}
        snapToAlignment="start"
        bounces={slides.length > 1}
        onMomentumScrollEnd={onScrollEnd}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 80);
        }}
        getItemLayout={(_, index) => ({
          length: slideWidth,
          offset: slideWidth * index,
          index,
        })}
        contentContainerStyle={styles.listContent}
        style={{ width: slideWidth }}
      />

      {slides.length > 1 && (
        <View style={styles.dotsRow}>
          {slides.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => goTo(i)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Banner ${i + 1} de ${slides.length}`}
              accessibilityState={{ selected: i === activeIndex }}
            >
              <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerWrap: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  listContent: {
    paddingHorizontal: HORIZONTAL_PAD,
  },
  slideOuter: {
    paddingRight: 0,
  },
  slideCard: {
    height: BANNER_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#CBD5E1',
    ...CARD_STEP_SHADOW,
  },
  expressCard: {
    height: 190,
    borderRadius: 24,
    paddingVertical: 20,
    paddingLeft: 20,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  expressLeft: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 2,
  },
  expressBadge: {
    alignSelf: 'flex-start',
    height: 34,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  expressBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: HOME_PALETTE.blue,
    letterSpacing: 0.2,
  },
  expressTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: HOME_PALETTE.darkGray,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  expressSubtitle: {
    fontSize: 12.5,
    fontWeight: '400',
    color: HOME_PALETTE.midGray,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  expressCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    height: 48,
    backgroundColor: HOME_PALETTE.blue,
    borderRadius: 12,
    paddingHorizontal: 14,
    maxWidth: '100%',
  },
  expressCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  expressPhotoWrap: {
    width: '30%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expressPhotoCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: HOME_PALETTE.circleLight,
  },
  expressPhotoInner: {
    width: '78%',
    height: '94%',
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  expressTimeChip: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    ...HOME_SOFT_SHADOW,
  },
  expressTimeChipIcon: {
    marginBottom: 2,
  },
  expressTimeChipValue: {
    fontSize: 15,
    fontWeight: '800',
    color: HOME_PALETTE.blue,
    lineHeight: 17,
  },
  expressTimeChipUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: HOME_PALETTE.blue,
    lineHeight: 13,
  },
  imageLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  textLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  photo: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderFailed: {
    backgroundColor: '#94A3B8',
  },
  placeholderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 24,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    width: '100%',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CHAMBA.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: CHAMBA.cyan,
  },
});
