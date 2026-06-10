import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';
import { useActiveHomeBanners } from '../hooks/useActiveHomeBanners';
import type { HomeBanner } from '../types';

const BANNER_HEIGHT = 168;
const AUTO_ADVANCE_MS = 5000;
const HORIZONTAL_PAD = 16;

/**
 * Slider informativo del inicio cliente.
 * Si no hay banners activos o falla la red → null silencioso.
 */
export const ClientHomeInfoBannerSlider: React.FC = () => {
  const { width: windowWidth } = useWindowDimensions();
  const slideWidth = Math.max(windowWidth - HORIZONTAL_PAD * 2, 280);
  const { data, isError, isLoading } = useActiveHomeBanners();
  const listRef = useRef<FlatList<HomeBanner>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const banners = data ?? [];

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / slideWidth);
    setActiveIndex(idx);
  }, [slideWidth]);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (isLoading || isError || banners.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={banners}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={slideWidth}
        snapToAlignment="start"
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: slideWidth,
          offset: slideWidth * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: slideWidth }]}>
            <Image
              source={{ uri: item.image_url }}
              style={styles.image}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        )}
      />
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View
              key={b.id}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: HORIZONTAL_PAD,
    marginBottom: 12,
    marginTop: 4,
  },
  slide: {
    height: BANNER_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    ...CARD_STEP_SHADOW,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: CHAMBA.border,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CHAMBA.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: CHAMBA.primary,
  },
});
