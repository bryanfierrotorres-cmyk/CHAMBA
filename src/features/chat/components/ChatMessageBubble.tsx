import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { formatChatTime } from '../utils/chatHelpers';
import type { ServiceMessage } from '@/types';

interface Props {
  message: ServiceMessage;
  isMine: boolean;
  accentColor: string;
}

export const ChatMessageBubble: React.FC<Props> = ({ message, isMine, accentColor }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [fade, slide]);

  return (
    <Animated.View
      style={[
        styles.row,
        isMine ? styles.rowMine : styles.rowTheirs,
        { opacity: fade, transform: [{ translateY: slide }] },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMine
            ? [styles.bubbleMine, { backgroundColor: accentColor }]
            : styles.bubbleTheirs,
        ]}
      >
        <Text style={[styles.text, isMine && styles.textMine]}>{message.texto}</Text>
        <Text style={[styles.time, isMine && styles.timeMine]}>
          {formatChatTime(message.creado_al)}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 6,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
    fontWeight: '400',
  },
  textMine: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  time: {
    marginTop: 6,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    alignSelf: 'flex-end',
  },
  timeMine: {
    color: 'rgba(255,255,255,0.78)',
  },
});
