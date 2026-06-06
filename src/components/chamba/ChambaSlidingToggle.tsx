import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CHAMBA } from '@constants/chambaUI';

const TAB_BAR_PADDING = 6;

export interface SlidingToggleOption<T extends string> {
  id: T;
  label: string;
}

interface ChambaSlidingToggleProps<T extends string> {
  options: SlidingToggleOption<T>[];
  active: T;
  onChange: (id: T) => void;
  style?: ViewStyle;
  /** Radio de esquinas (p. ej. 12 en login). Por defecto 30 contenedor / 24 pill. */
  cornerRadius?: number;
  /** Peso tipográfico del segmento activo. */
  activeFontWeight?: '600' | '700';
}

export function ChambaSlidingToggle<T extends string>({
  options,
  active,
  onChange,
  style,
  cornerRadius,
  activeFontWeight = '700',
}: ChambaSlidingToggleProps<T>) {
  const outerRadius = cornerRadius ?? 30;
  const pillRadius = cornerRadius ?? 24;
  const [barWidth, setBarWidth] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((o) => o.id === active));
  const slide = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    const idx = Math.max(0, options.findIndex((o) => o.id === active));
    Animated.spring(slide, {
      toValue: idx,
      useNativeDriver: true,
      speed: 18,
      bounciness: 5,
    }).start();
  }, [active, options, slide]);

  const tabCount = options.length;
  const pillWidth = barWidth > 0 ? (barWidth - TAB_BAR_PADDING * 2) / tabCount : 0;

  const translateX = slide.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * pillWidth),
  });

  const activeOpacityFor = (index: number) =>
    slide.interpolate({
      inputRange: options.map((_, i) => i),
      outputRange: options.map((_, i) => {
        if (i === index) return 1;
        if (Math.abs(i - index) === 1) return 0.25;
        return 0;
      }),
    });

  const inactiveOpacityFor = (index: number) =>
    slide.interpolate({
      inputRange: options.map((_, i) => i),
      outputRange: options.map((_, i) => {
        if (i === index) return 0;
        if (Math.abs(i - index) === 1) return 0.75;
        return 1;
      }),
    });

  return (
    <View
      style={[
        styles.tabOuterContainer,
        { backgroundColor: CHAMBA.toggleBg, borderRadius: outerRadius },
        style,
      ]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {pillWidth > 0 && (
        <Animated.View
          style={[
            styles.tabActivePill,
            styles.modeTogglePill,
            { width: pillWidth, borderRadius: pillRadius, transform: [{ translateX }] },
          ]}
        >
          <LinearGradient
            colors={[CHAMBA.primary, CHAMBA.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.gradientButton, { borderRadius: pillRadius }]}
          />
        </Animated.View>
      )}

      {options.map((option, index) => (
        <TouchableOpacity
          key={option.id}
          style={styles.tabInactiveButton}
          activeOpacity={0.85}
          onPress={() => onChange(option.id)}
        >
          <View style={styles.tabLabelStack}>
            <Animated.Text
              style={[
                styles.tabTextActive,
                styles.tabLabelOverlay,
                { opacity: activeOpacityFor(index), fontWeight: activeFontWeight },
              ]}
            >
              {option.label}
            </Animated.Text>
            <Animated.Text style={[styles.tabTextInactive, { opacity: inactiveOpacityFor(index) }]}>
              {option.label}
            </Animated.Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabOuterContainer: {
    flexDirection: 'row',
    padding: TAB_BAR_PADDING,
    alignItems: 'center',
    shadowColor: '#6B7280',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  modeTogglePill: {
    position: 'absolute',
    left: TAB_BAR_PADDING,
    top: TAB_BAR_PADDING,
    bottom: TAB_BAR_PADDING,
    zIndex: 0,
  },
  tabActivePill: {
    shadowColor: CHAMBA.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabInactiveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabLabelStack: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tabLabelOverlay: {
    position: 'absolute',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  tabTextInactive: {
    color: CHAMBA.inactive,
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: 'transparent',
  },
});
