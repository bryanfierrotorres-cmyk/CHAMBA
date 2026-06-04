import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientJobStatusRealtime } from '@features/client/hooks/useClientJobStatusRealtime';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';

/**
 * Banner superior cuando cambia el estado de una solicitud del cliente (Realtime).
 */
export const ClientJobStatusToast: React.FC = () => {
  const insets = useSafeAreaInsets();
  const toast = useClientJobStatusRealtime();
  const translateY = useRef(new Animated.Value(-120)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return undefined;

    if (hideTimer.current) clearTimeout(hideTimer.current);
    translateY.setValue(-120);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    hideTimer.current = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -120,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }, 4500);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [toast, translateY]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 8, transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity activeOpacity={0.92} style={styles.banner}>
        <Ionicons name="notifications" size={20} color={CHAMBA.teal} />
        <Text style={styles.text} numberOfLines={2}>
          {toast.message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CHAMBA.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#99F6E4',
    ...CARD_STEP_SHADOW,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: CHAMBA.navy,
    lineHeight: 19,
  },
});
