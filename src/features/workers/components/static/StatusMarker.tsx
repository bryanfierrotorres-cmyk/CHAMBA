import React from 'react';
import { useEffect } from 'react';
const _keepReact = React;
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from 'react-native-reanimated';

type Props = {
  status: 'pending' | 'assigned' | 'arrived' | 'in_progress' | 'completed';
};

export const StatusMarker = React.memo(({ status }: Props) => {
  const scale = useSharedValue(1);
  const halo = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1);
    if (status === 'in_progress') {
      scale.value = withRepeat(
        withSequence(withTiming(1.2, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1
      );
      halo.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
    } else if (status === 'arrived') {
      scale.value = withRepeat(withTiming(1.15, { duration: 600 }), -1, true);
    }
  }, [status]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 1], [0.2, 0.6]),
    transform: [{ scale: interpolate(halo.value, [0, 1], [1, 2.2]) }],
  }));

  return (
    <View style={{ position: 'relative', justifyContent: 'center', alignItems: 'center', width: 30, height: 30 }}>
      {status === 'in_progress' && (
        <Animated.View style={[haloStyle, { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: '#3b82f6' }]} />
      )}
      <Animated.View style={[animatedStyle]}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: status === 'completed' ? '#22c55e' : status === 'in_progress' ? '#3b82f6' : '#9ca3af' }} />
      </Animated.View>
    </View>
  );
});
