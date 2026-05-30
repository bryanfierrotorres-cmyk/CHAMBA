import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, Animated, PanResponder, ActivityIndicator,
  StyleSheet, LayoutChangeEvent, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { M3, SPACING, BORDER_RADIUS } from '@constants/stitchStyles';

const THUMB_SIZE = 48;
const SWIPE_THRESHOLD = 0.7;

type SwipePhase = 'idle' | 'loading' | 'accepted' | 'in_process';

interface SwipeAcceptTrackProps {
  onAccept:       () => void | Promise<void>;
  isLoading?:     boolean;
  isAccepted?:    boolean;
  isInProcess?:   boolean;
  onInProcess?:   () => void;
  label?:         string;
  successLabel?:  string;
  processLabel?:  string;
}

export const SwipeAcceptTrack: React.FC<SwipeAcceptTrackProps> = ({
  onAccept,
  isLoading = false,
  isAccepted = false,
  isInProcess = false,
  onInProcess,
  label = 'Desliza para aceptar',
  successLabel = '¡Aceptado!',
  processLabel = 'En proceso',
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const [phase, setPhase] = useState<SwipePhase>(() => {
    if (isInProcess) return 'in_process';
    if (isAccepted) return 'accepted';
    return 'idle';
  });

  const translateX = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const dragX = useRef(0);
  const maxTravelRef = useRef(0);
  const phaseRef = useRef<SwipePhase>(phase);

  maxTravelRef.current = Math.max(0, trackWidth - THUMB_SIZE);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (isInProcess) setPhase('in_process');
    else if (isAccepted && phase !== 'loading') setPhase('accepted');
  }, [isAccepted, isInProcess]);

  useEffect(() => {
    if (isLoading && phase === 'idle') setPhase('loading');
  }, [isLoading]);

  const snapBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
      Animated.timing(textOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    dragX.current = 0;
  }, [translateX, textOpacity]);

  const runAcceptFlow = useCallback(async () => {
    if (phaseRef.current !== 'idle') return;
    setPhase('loading');

    Animated.timing(translateX, {
      toValue: maxTravelRef.current,
      duration: 280,
      useNativeDriver: true,
    }).start();

    try {
      await Promise.resolve(onAccept());
      setPhase('accepted');
      setTimeout(() => {
        setPhase('in_process');
        onInProcess?.();
      }, 1400);
    } catch {
      setPhase('idle');
      snapBack();
    }
  }, [onAccept, onInProcess, snapBack, translateX]);

  const onDragMove = useCallback((dx: number) => {
    if (phaseRef.current !== 'idle') return;
    const max = maxTravelRef.current;
    if (max <= 0) return;
    const x = Math.max(0, Math.min(dx, max));
    dragX.current = x;
    translateX.setValue(x);
    textOpacity.setValue(1 - x / max);
  }, [translateX, textOpacity]);

  const onDragEnd = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    const max = maxTravelRef.current;
    if (max <= 0) return;
    if (dragX.current > max * SWIPE_THRESHOLD) {
      void runAcceptFlow();
    } else {
      snapBack();
    }
  }, [runAcceptFlow, snapBack]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => phaseRef.current === 'idle' && maxTravelRef.current > 0,
      onMoveShouldSetPanResponder: (_, g) =>
        phaseRef.current === 'idle' && maxTravelRef.current > 0 && Math.abs(g.dx) > 4,
      onPanResponderGrant: () => {
        dragX.current = 0;
      },
      onPanResponderMove: (_, g) => onDragMove(g.dx),
      onPanResponderRelease: () => onDragEnd(),
      onPanResponderTerminate: () => snapBack(),
    }),
    [onDragMove, onDragEnd, snapBack],
  );

  // Web: pointer events (PanResponder falla a menudo en mouse)
  const pointerStart = useRef(0);
  const isPointerDown = useRef(false);

  const onPointerDown = (e: { nativeEvent: { pageX: number } }) => {
    if (phaseRef.current !== 'idle' || maxTravelRef.current <= 0) return;
    isPointerDown.current = true;
    pointerStart.current = e.nativeEvent.pageX;
  };

  const onPointerMove = (e: { nativeEvent: { pageX: number } }) => {
    if (!isPointerDown.current) return;
    onDragMove(e.nativeEvent.pageX - pointerStart.current);
  };

  const onPointerUp = () => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    onDragEnd();
  };

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  if (phase === 'in_process' || isInProcess) {
    return (
      <View style={[styles.track, styles.trackProcess]}>
        <Ionicons name="time" size={22} color={M3.primary} />
        <Text style={styles.processText}>{processLabel}</Text>
        <Text style={styles.processHint}>Ver en Agenda</Text>
      </View>
    );
  }

  if (phase === 'accepted') {
    return (
      <View style={[styles.track, styles.trackSuccess]}>
        <Ionicons name="checkmark-circle" size={22} color={M3.secondary} />
        <Text style={styles.successText}>{successLabel}</Text>
      </View>
    );
  }

  if (phase === 'loading' || isLoading) {
    return (
      <View style={styles.track}>
        <ActivityIndicator color={M3.primary} />
        <Text style={styles.label}>Procesando...</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.track}
      onLayout={onLayout}
      {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      {...(Platform.OS === 'web' ? {
        onMouseDown: onPointerDown,
        onMouseMove: onPointerMove,
        onMouseUp: onPointerUp,
        onMouseLeave: onPointerUp,
      } : {})}
    >
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.Text style={[styles.label, { opacity: textOpacity }]}>
          {label}
        </Animated.Text>
      </View>
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX }] }]}
      >
        <Ionicons name="chevron-forward" size={24} color={M3.onPrimary} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height:          THUMB_SIZE,
    borderRadius:    BORDER_RADIUS.full,
    backgroundColor: M3.surfaceContainer,
    justifyContent:  'center',
    alignItems:      'center',
    overflow:        'hidden',
    position:        'relative',
    ...(Platform.OS === 'web' ? { cursor: 'grab', userSelect: 'none' as const, touchAction: 'none' as const } : {}),
  },
  trackSuccess: {
    flexDirection:   'row',
    gap:             SPACING.sm,
    backgroundColor: M3.secondaryFixed,
  },
  trackProcess: {
    flexDirection:   'row',
    gap:             SPACING.sm,
    backgroundColor: M3.primaryFixed,
  },
  label: {
    fontSize:   16,
    fontWeight: '600',
    color:      M3.primary,
  },
  successText: {
    fontSize:   16,
    fontWeight: '700',
    color:      M3.secondary,
  },
  processText: {
    fontSize:   16,
    fontWeight: '700',
    color:      M3.primary,
  },
  processHint: {
    fontSize:   12,
    fontWeight: '600',
    color:      M3.onPrimaryFixedVariant,
    marginLeft: SPACING.xs,
  },
  thumb: {
    position:        'absolute',
    left:            0,
    top:             0,
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    borderRadius:    THUMB_SIZE / 2,
    backgroundColor: M3.primary,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          2,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.15,
    shadowRadius:    4,
    elevation:       3,
    ...(Platform.OS === 'web' ? { cursor: 'grab' as const } : {}),
  },
});
