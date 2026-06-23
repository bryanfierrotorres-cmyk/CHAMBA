import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { formatChatTime } from '../utils/chatHelpers';
import { CHAT_THEME } from '../constants/chatTheme';
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
      Animated.timing(fade, { 
        toValue: message.isOptimistic ? 0.6 : 1, 
        duration: 220, 
        useNativeDriver: true 
      }),
      Animated.spring(slide, { 
        toValue: 0, 
        friction: 10, 
        tension: 90, 
        useNativeDriver: true 
      }),
    ]).start();
  }, [fade, slide, message.isOptimistic]);

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
        <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>
          {message.texto}
        </Text>
        <Text style={[styles.time, isMine && styles.timeMine]}>
          {formatChatTime(message.creado_al)}
        </Text>
      </View>
    </Animated.View>
  );
};

const BUBBLE_RADIUS = 16;
const BUBBLE_TAIL = 4;

const styles = StyleSheet.create({
  row: {
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleMine: {
    borderTopLeftRadius: BUBBLE_RADIUS,
    borderTopRightRadius: BUBBLE_RADIUS,
    borderBottomLeftRadius: BUBBLE_RADIUS,
    borderBottomRightRadius: BUBBLE_TAIL,
  },
  bubbleTheirs: {
    backgroundColor: CHAT_THEME.bubbleTheirs,
    borderTopLeftRadius: BUBBLE_RADIUS,
    borderTopRightRadius: BUBBLE_RADIUS,
    borderBottomLeftRadius: BUBBLE_TAIL,
    borderBottomRightRadius: BUBBLE_RADIUS,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  textMine: {
    color: '#FFFFFF',
  },
  textTheirs: {
    color: CHAT_THEME.textPrimary,
  },
  time: {
    marginTop: 5,
    fontSize: 10,
    color: CHAT_THEME.time,
    fontWeight: '500',
    alignSelf: 'flex-end',
  },
  timeMine: {
    color: 'rgba(255,255,255,0.72)',
  },
});
