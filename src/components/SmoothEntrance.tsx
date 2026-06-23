import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export const SmoothEntrance: React.FC<Props> = ({ children, style, delay = 0 }) => {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    const animations = [
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ];

    if (delay > 0) {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel(animations),
      ]).start();
    } else {
      Animated.parallel(animations).start();
    }
  }, [opacityAnim, scaleAnim, delay]);

  return (
    <Animated.View style={[style, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      {children}
    </Animated.View>
  );
};
