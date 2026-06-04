import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Pressable,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';
import type { ClientHeroSlide } from '@constants/clientHomeHeroSlides';

const BANNER_HEIGHT = 196;
const AUTO_ADVANCE_MS = 4500;
const HORIZONTAL_PAD = 0;

interface HeroSlidePhotoProps {
  slide: ClientHeroSlide;
}

/** Foto con respaldo si la URL principal no carga (común en web con Unsplash). */
const HeroSlidePhoto: React.FC<HeroSlidePhotoProps> = ({ slide }) => {
  const [uri, setUri] = useState(slide.imageUri);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setUri(slide.imageUri);
    setExhausted(false);
  }, [slide.id, slide.imageUri]);

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
      style={styles.photo}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      onError={onError}
    />
  );
};

interface ClientHomeHeroCarouselProps {
  slides: ClientHeroSlide[];
}

/**
 * Banner superior del Home — deslizador horizontal aislado.
 * No modifica ni depende de la grilla de categorías (Express, etc.).
 */
export const ClientHomeHeroCarousel: React.FC<ClientHomeHeroCarouselProps> = ({
  slides,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const slideWidth = screenWidth - 40;
  const listRef = useRef<FlatList<ClientHeroSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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

  const renderSlide = ({ item }: { item: ClientHeroSlide }) => (
    <View style={[styles.slideOuter, { width: slideWidth }]}>
      <View style={styles.slideCard}>
        <HeroSlidePhoto slide={item} />

        <LinearGradient
          colors={['transparent', 'rgba(15, 23, 42, 0.55)', 'rgba(15, 23, 42, 0.85)']}
          locations={[0.35, 0.65, 1]}
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
  );

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
    backgroundColor: '#CBD5E1',
    ...CARD_STEP_SHADOW,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
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
