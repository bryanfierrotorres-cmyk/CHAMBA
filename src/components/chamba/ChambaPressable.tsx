import React from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_PRESS = { damping: 18, stiffness: 420, mass: 0.35 };
const SPRING_RELEASE = { damping: 14, stiffness: 320, mass: 0.4 };

export interface ChambaPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Escala al presionar (default 0.96). */
  pressScale?: number;
}

/**
 * Tarjeta/ficha táctil con feedback de escala — uso en Express, Premium y panel trabajador.
 */
export const ChambaPressable: React.FC<ChambaPressableProps> = ({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  pressScale = 0.96,
  ...rest
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn: PressableProps['onPressIn'] = (e) => {
    if (!disabled) {
      scale.value = withSpring(pressScale, SPRING_PRESS);
    }
    onPressIn?.(e);
  };

  const handlePressOut: PressableProps['onPressOut'] = (e) => {
    scale.value = withSpring(1, SPRING_RELEASE);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[style, animatedStyle]}
      accessibilityRole={rest.accessibilityRole ?? (onPress ? 'button' : undefined)}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};
