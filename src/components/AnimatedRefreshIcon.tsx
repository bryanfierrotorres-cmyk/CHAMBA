import React, { useEffect, useRef } from 'react';
import { Animated, Easing, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  isRefetching: boolean;
  onPress: () => void;
  color?: string;
  size?: number;
  style?: any;
}

export const AnimatedRefreshIcon: React.FC<Props> = ({
  isRefetching,
  onPress,
  color = '#0F172A',
  size = 24,
  style,
}) => {
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    
    if (isRefetching) {
      rotationAnim.setValue(0);
      loop = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
    } else {
      // Allow it to naturally finish or stop immediately if we want
      // It will stop when isRefetching becomes false
      rotationAnim.stopAnimation((value) => {
        // Option 1: Snap back to 0 immediately when done
        // rotationAnim.setValue(0);
        
        // Option 2: Finish the current turn
        Animated.timing(rotationAnim, {
          toValue: Math.ceil(value),
          duration: (Math.ceil(value) - value) * 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => {
          rotationAnim.setValue(0);
        });
      });
    }

    return () => {
      if (loop) loop.stop();
    };
  }, [isRefetching, rotationAnim]);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity onPress={onPress} style={style} activeOpacity={0.7} disabled={isRefetching}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Ionicons name="refresh-outline" size={size} color={color} />
      </Animated.View>
    </TouchableOpacity>
  );
};
