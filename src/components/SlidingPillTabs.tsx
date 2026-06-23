import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { CARD_STEP_SHADOW } from '@constants/chambaUI';

interface TabOption {
  id: string;
  label: string;
}

interface Props {
  options: TabOption[];
  active: string;
  onChange: (id: string) => void;
}

export const SlidingPillTabs: React.FC<Props> = ({ options, active, onChange }) => {
  const activeIndex = options.findIndex((o) => o.id === active) || 0;
  
  const [containerWidth, setContainerWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // We assume all tabs have equal width since flex: 1 is used.
  const tabWidth = containerWidth / options.length;

  useEffect(() => {
    if (tabWidth > 0) {
      Animated.timing(slideAnim, {
        toValue: activeIndex * tabWidth,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, tabWidth, slideAnim]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.pillTabsContainer} onLayout={onLayout}>
      {/* Animated Background Pill */}
      {tabWidth > 0 && (
        <Animated.View
          style={[
            styles.animatedBackground,
            { width: tabWidth, transform: [{ translateX: slideAnim }] },
          ]}
        />
      )}

      {options.map((tab) => {
        const isActive = active === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.pillTab}
            onPress={() => onChange(tab.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillTabText, isActive && styles.pillTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  pillTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 6,
    marginHorizontal: 20,
    marginBottom: 16,
    position: 'relative',
  },
  animatedBackground: {
    position: 'absolute',
    top: 6, // to account for padding
    bottom: 6,
    left: 6,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    ...CARD_STEP_SHADOW,
  },
  pillTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pillTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  pillTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
