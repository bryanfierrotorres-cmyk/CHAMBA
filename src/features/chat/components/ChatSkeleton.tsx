import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const SkeletonBar: React.FC<{ width: number | `${number}%`; height?: number }> = ({
  width,
  height = 14,
}) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.bar, { width, height, opacity }]}
    />
  );
};

export const ChatSkeleton: React.FC = () => (
  <View style={styles.wrap}>
    <View style={styles.rowLeft}>
      <SkeletonBar width="62%" height={44} />
    </View>
    <View style={styles.rowRight}>
      <SkeletonBar width="48%" height={36} />
    </View>
    <View style={styles.rowLeft}>
      <SkeletonBar width="55%" height={36} />
    </View>
    <View style={styles.rowRight}>
      <SkeletonBar width="70%" height={52} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 14,
    backgroundColor: '#F9FAFB',
  },
  rowLeft: { alignItems: 'flex-start' },
  rowRight: { alignItems: 'flex-end' },
  bar: {
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
  },
});
