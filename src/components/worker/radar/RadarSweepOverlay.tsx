import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface RadarSweepOverlayProps {
  size?: number;
  color?: string;
}

const RING_RATIOS = [1, 0.7, 0.42];

/** Radar interactivo: anillos + haz giratorio continuo + punto central (reemplaza la antena estática). */
export const RadarSweepOverlay: React.FC<RadarSweepOverlayProps> = ({
  size = 190,
  color = '#22C55E',
}) => {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animated.loop(Animated.timing(...)) solo, sin paso de reset explícito, se queda
    // congelado en el valor final en este entorno RN-Web — se agrega un reset instantáneo.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, {
          toValue: 1,
          duration: 3200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const half = size / 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      <View style={[styles.shadowRing, { width: size, height: size, borderRadius: half }]} />
      <View style={[styles.clip, { width: size, height: size, borderRadius: half }]}>
        {RING_RATIOS.map((ratio) => {
          const ringSize = size * ratio;
          return (
            <View
              key={ratio}
              style={[
                styles.ring,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                },
              ]}
            />
          );
        })}

        <Animated.View
          style={[styles.sweepWrap, { width: size, height: size, transform: [{ rotate: spin }] }]}
        >
          <View style={[styles.sweepQuadrant, { width: half, height: half, top: 0, left: half }]}>
            <LinearGradient
              colors={[`${color}80`, `${color}00`]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        </Animated.View>
      </View>

      <View style={styles.centerDot}>
        <View style={styles.centerDotInner} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowRing: {
    position: 'absolute',
    backgroundColor: 'rgba(37,99,235,0.06)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  clip: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.05)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(15,23,42,0.28)',
  },
  sweepWrap: {
    position: 'absolute',
  },
  sweepQuadrant: {
    position: 'absolute',
    overflow: 'hidden',
  },
  centerDot: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(37,99,235,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
