import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADAR_BORDER, RADAR_DEEP_BLUE, RADAR_MUTED, RADAR_TITLE } from './radarTheme';
import { RADIUS_OPTIONS_KM } from '@utils/workerSearchRadius';

interface RadarRadiusBarProps {
  radiusKm: number;
  onChange: (km: number) => void;
}

export const RadarRadiusBar: React.FC<RadarRadiusBarProps> = ({ radiusKm, onChange }) => {
  const [open, setOpen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue: number) => {
    Animated.timing(anim, {
      toValue,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    animateTo(next ? 1 : 0);
  };

  const pick = (km: number) => {
    onChange(km);
    setOpen(false);
    animateTo(0);
  };

  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] });
  const chevronRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.bar}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel="Cambiar radio de búsqueda"
      >
        <View style={styles.left}>
          <View style={styles.iconWrap}>
            <Ionicons name="radio-outline" size={16} color={RADAR_DEEP_BLUE} />
          </View>
          <Text style={styles.label}>Radio de búsqueda</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.value}>{radiusKm} km</Text>
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Ionicons name="chevron-down" size={16} color={RADAR_MUTED} />
          </Animated.View>
        </View>
      </Pressable>

      <Animated.View style={[styles.animWrap, { height: contentHeight ? height : 0, opacity: anim }]}>
        <View
          style={styles.panel}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - contentHeight) > 1) setContentHeight(h);
          }}
        >
          <View style={styles.optionsGrid}>
            {RADIUS_OPTIONS_KM.map((km) => {
              const active = km === radiusKm;
              return (
                <Pressable
                  key={km}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => pick(km)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {km} km
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13.5,
    fontWeight: '700',
    color: RADAR_TITLE,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 13.5,
    fontWeight: '700',
    color: RADAR_DEEP_BLUE,
  },
  animWrap: {
    overflow: 'hidden',
  },
  panel: {
    borderTopWidth: 1,
    borderTopColor: RADAR_BORDER,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    minWidth: 62,
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: RADAR_DEEP_BLUE,
    borderColor: RADAR_DEEP_BLUE,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
    color: RADAR_TITLE,
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
});
