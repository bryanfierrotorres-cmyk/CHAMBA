import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';
import type { ClientHeroSlide } from '@constants/clientHomeHeroSlides';

const ROTATE_MS = 2000;
const FADE_MS = 320;

interface ClientHomeHeroCarouselProps {
  slides: ClientHeroSlide[];
}

/**
 * Banner del inicio cliente: rota mensajes cada 2 s con transición suave e indicadores.
 */
export const ClientHomeHeroCarousel: React.FC<ClientHomeHeroCarouselProps> = ({
  slides,
}) => {
  const [index, setIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = slides.length;

  const startAutoplay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (count <= 1) return;
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, ROTATE_MS);
  }, [count]);

  useEffect(() => {
    startAutoplay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoplay]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  const goTo = (next: number) => {
    setIndex(next);
    startAutoplay();
  };

  if (count === 0) return null;

  const slide = slides[index];

  return (
    <View style={styles.banner}>
      <View style={styles.imageFrame}>
        <Animated.View
          key={`${slide.id}-${index}`}
          entering={FadeIn.duration(FADE_MS)}
          exiting={FadeOut.duration(FADE_MS * 0.7)}
          style={styles.slideLayer}
        >
          <Image source={{ uri: slide.imageUri }} style={styles.heroImage} />
        </Animated.View>
      </View>

      <Animated.View
        key={`cap-${slide.id}-${index}`}
        entering={FadeIn.duration(FADE_MS)}
        exiting={FadeOut.duration(FADE_MS * 0.7)}
        style={styles.heroCaption}
      >
        <Text style={styles.heroTitle} numberOfLines={2}>
          {slide.title}
        </Text>
        <Text style={styles.heroSubtitle} numberOfLines={2}>
          {slide.subtitle}
        </Text>

        {count > 1 && (
          <View style={styles.dotsRow}>
            {slides.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => goTo(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Mensaje ${i + 1} de ${count}`}
                accessibilityState={{ selected: i === index }}
              >
                <View style={[styles.dot, i === index && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: CHAMBA.white,
    ...CARD_STEP_SHADOW,
  },
  imageFrame: {
    width: '100%',
    height: 120,
    backgroundColor: CHAMBA.border,
    overflow: 'hidden',
  },
  slideLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroCaption: {
    backgroundColor: CHAMBA.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    minHeight: 88,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: CHAMBA.navy,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: CHAMBA.muted,
    fontWeight: '400',
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
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
