import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  StyleSheet,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DISMISS_THRESHOLD = 0.38;

type GestureEvent = {
  nativeEvent: {
    pageX?: number;
    locationX?: number;
    touches?: { pageX: number }[];
  };
};

interface SwipeableRadarJobCardProps {
  children: React.ReactNode;
  enabled?: boolean;
  onDismiss: () => void;
}

export const SwipeableRadarJobCard: React.FC<SwipeableRadarJobCardProps> = ({
  children,
  enabled = true,
  onDismiss,
}) => {
  const cardWidth = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);
  const dismissingRef = useRef(false);
  const isPointerDown = useRef(false);
  const pointerStart = useRef(0);

  const snapBack = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 140,
      friction: 12,
    }).start(() => {
      dragStart.current = 0;
    });
  }, [translateX]);

  const runDismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    const width = cardWidth.current || 320;
    Animated.timing(translateX, {
      toValue: -width * 1.15,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
      dismissingRef.current = false;
      translateX.setValue(0);
      dragStart.current = 0;
    });
  }, [onDismiss, translateX]);

  const applyDrag = useCallback((dx: number) => {
    const clamped = Math.min(0, dx);
    translateX.setValue(clamped);
  }, [translateX]);

  const onDragEnd = useCallback(() => {
    if (!enabled || dismissingRef.current) return;
    const width = cardWidth.current;
    if (width <= 0) {
      snapBack();
      return;
    }
    const current = dragStart.current;
    if (Math.abs(current) >= width * DISMISS_THRESHOLD) {
      runDismiss();
    } else {
      snapBack();
    }
  }, [enabled, runDismiss, snapBack]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => enabled && !dismissingRef.current,
      onMoveShouldSetPanResponder: (_, gesture) =>
        enabled
        && !dismissingRef.current
        && gesture.dx < -6
        && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          dragStart.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 8) return;
        applyDrag(dragStart.current + gesture.dx);
      },
      onPanResponderRelease: () => {
        translateX.stopAnimation((value) => {
          dragStart.current = value;
          onDragEnd();
        });
      },
      onPanResponderTerminate: () => snapBack(),
    }),
    [applyDrag, enabled, onDragEnd, snapBack, translateX],
  );

  const readPageX = useCallback((e: GestureEvent): number => {
    const ne = e.nativeEvent;
    if (typeof ne.pageX === 'number') return ne.pageX;
    if (ne.touches?.length) return ne.touches[0].pageX;
    return ne.locationX ?? 0;
  }, []);

  const webGestureHandlers = Platform.OS === 'web' && enabled ? {
    onPointerDown: (e: GestureEvent & { preventDefault?: () => void }) => {
      if (dismissingRef.current) return;
      isPointerDown.current = true;
      pointerStart.current = readPageX(e);
      translateX.stopAnimation((value) => {
        dragStart.current = value;
      });
    },
    onPointerMove: (e: GestureEvent & { preventDefault?: () => void }) => {
      if (!isPointerDown.current || dismissingRef.current) return;
      const dx = readPageX(e) - pointerStart.current;
      if (dx > 8) return;
      e.preventDefault?.();
      applyDrag(dragStart.current + dx);
    },
    onPointerUp: () => {
      if (!isPointerDown.current) return;
      isPointerDown.current = false;
      translateX.stopAnimation((value) => {
        dragStart.current = value;
        onDragEnd();
      });
    },
    onPointerCancel: () => {
      isPointerDown.current = false;
      snapBack();
    },
  } : {};

  const onLayout = (e: LayoutChangeEvent) => {
    cardWidth.current = e.nativeEvent.layout.width;
  };

  if (!enabled) {
    return <View style={styles.wrap}>{children}</View>;
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View style={styles.dismissRail} pointerEvents="none">
        <Ionicons name="eye-off-outline" size={22} color="#FFFFFF" />
        <Text style={styles.dismissLabel}>Apartar</Text>
      </View>

      <Animated.View
        style={[styles.cardLayer, { transform: [{ translateX }] }]}
        {...(Platform.OS !== 'web' ? panResponder.panHandlers : webGestureHandlers)}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const webCardStyle = Platform.OS === 'web'
  ? ({
      cursor: 'grab',
      userSelect: 'none',
      touchAction: 'pan-y',
    } as Record<string, string>)
  : {};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: 0,
  },
  dismissRail: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingRight: 22,
    borderRadius: 16,
    backgroundColor: '#64748B',
  },
  dismissLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardLayer: {
    ...webCardStyle,
  },
});
