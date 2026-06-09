import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { COLORS } from '@constants/theme';

interface SplashScreenProps {
  onFinish: () => void;
  /** No desvanecer hasta que la sesión esté restaurada (evita pantalla en blanco al refrescar). */
  authReady?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, authReady = true }) => {
  const logoScale     = useRef(new Animated.Value(0.4)).current;
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textY         = useRef(new Animated.Value(20)).current;
  const taglineOp     = useRef(new Animated.Value(0)).current;
  const pulseScale    = useRef(new Animated.Value(1)).current;
  const bgOpacity     = useRef(new Animated.Value(1)).current;
  const animationDone = useRef(false);
  const finished      = useRef(false);

  const tryFinish = () => {
    if (finished.current) return;
    if (animationDone.current && authReady) {
      finished.current = true;
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onFinish());
    }
  };

  useEffect(() => {
    tryFinish();
  }, [authReady]);

  useEffect(() => {
    Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }).start();
    Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(textY,       { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(600),
      Animated.timing(taglineOp, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(500),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.06, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1,    duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        { iterations: 2 },
      ),
    ]).start();

    const timer = setTimeout(() => {
      animationDone.current = true;
      tryFinish();
    }, 1000);

    // Fallback: no bloquear más de 2s aunque auth no responda
    const failsafe = setTimeout(() => {
      if (!finished.current) {
        finished.current = true;
        onFinish();
      }
    }, 2_000);

    return () => {
      clearTimeout(timer);
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: bgOpacity }]}>
      {/* Background circles */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />

      {/* Logo */}
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [{ scale: Animated.multiply(logoScale, pulseScale) }],
          opacity: logoOpacity,
        }}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>⚡</Text>
        </View>
      </Animated.View>

      {/* Text */}
      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textY }],
          alignItems: 'center',
          marginTop: 28,
        }}
      >
        <Text style={styles.appName}>CHAMBA</Text>
        <Animated.Text style={[styles.tagline, { opacity: taglineOp }]}>
          Trabaja · Cobra · Vuela
        </Animated.Text>
      </Animated.View>

      {/* Loader dots */}
      <Animated.View style={[styles.dotsRow, { opacity: taglineOp }]}>
        {[0, 1, 2].map((i) => (
          <PulsingDot key={i} delay={i * 200} />
        ))}
      </Animated.View>
    </Animated.View>
  );
};

const PulsingDot: React.FC<{ delay: number }> = ({ delay }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1,    duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return <Animated.View style={[styles.dot, { opacity }]} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: COLORS.brand[700],
    opacity: 0.25,
    top: -100,
    right: -120,
  },
  circle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.brand[800],
    opacity: 0.2,
    bottom: -80,
    left: -80,
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: COLORS.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.brand[400],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  logoEmoji: {
    fontSize: 52,
  },
  appName: {
    color: COLORS.white,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 6,
  },
  tagline: {
    color: COLORS.brand[300],
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 2,
    marginTop: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 64,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.brand[300],
  },
});
