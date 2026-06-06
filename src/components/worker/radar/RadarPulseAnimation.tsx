import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADAR_DEEP_BLUE } from './radarTheme';

const RING_COUNT = 3;
const PULSE_SIZE = 128;
const CENTER_SIZE = 52;

type RingAnim = {
  scale: Animated.Value;
  opacity: Animated.Value;
};

export const RadarPulseAnimation: React.FC = () => {
  const rings = useRef<RingAnim[]>(
    Array.from({ length: RING_COUNT }, () => ({
      scale: new Animated.Value(0.4),
      opacity: new Animated.Value(0.22),
    })),
  ).current;

  useEffect(() => {
    const loops = rings.map((ring, index) => {
      const stagger = index * 650;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(stagger),
          Animated.parallel([
            Animated.timing(ring.scale, {
              toValue: 1.15,
              duration: 2200,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(ring.opacity, {
              toValue: 0,
              duration: 2200,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(ring.scale, {
              toValue: 0.4,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(ring.opacity, {
              toValue: 0.22,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
    });

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [rings]);

  return (
    <View style={styles.wrap}>
      {rings.map((ring, index) => (
        <Animated.View
          key={index}
          style={[
            styles.ring,
            {
              opacity: ring.opacity,
              transform: [{ scale: ring.scale }],
            },
          ]}
        />
      ))}
      <View style={styles.center}>
        <Ionicons name="briefcase-outline" size={26} color={RADAR_DEEP_BLUE} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(30, 41, 59, 0.22)',
    backgroundColor: 'rgba(30, 41, 59, 0.06)',
  },
  center: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
});
