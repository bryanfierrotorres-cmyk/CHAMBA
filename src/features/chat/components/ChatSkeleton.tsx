import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { CHAT_THEME } from '../constants/chatTheme';

const SkeletonBar: React.FC<{ width: number | `${number}%`; height?: number; align?: 'left' | 'right' }> = ({
  width,
  height = 14,
  align = 'left',
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.bar,
        align === 'right' ? styles.barMine : styles.barTheirs,
        { width, height, opacity },
      ]}
    />
  );
};

export const ChatSkeleton: React.FC = () => (
  <View style={styles.wrap}>
    <View style={styles.rowLeft}>
      <SkeletonBar width="58%" height={44} />
    </View>
    <View style={styles.rowRight}>
      <SkeletonBar width="42%" height={38} align="right" />
    </View>
    <View style={styles.rowLeft}>
      <SkeletonBar width="50%" height={38} />
    </View>
    <View style={styles.rowRight}>
      <SkeletonBar width="64%" height={52} align="right" />
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
    backgroundColor: CHAT_THEME.bg,
  },
  rowLeft: { alignItems: 'flex-start' },
  rowRight: { alignItems: 'flex-end' },
  bar: {
    borderRadius: 16,
  },
  barTheirs: {
    backgroundColor: CHAT_THEME.bubbleTheirs,
  },
  barMine: {
    backgroundColor: `${CHAT_THEME.clientAccent}28`,
    borderBottomRightRadius: 4,
  },
});
