import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, Animated, PanResponder, ActivityIndicator,
  StyleSheet, LayoutChangeEvent, Platform, TouchableOpacity, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CHAMBA, GRADIENT_TOGGLE } from '@constants/chambaUI';

const THUMB_SIZE = 52;
const SWIPE_THRESHOLD = 0.55;
const TAP_MOVE_THRESHOLD = 12;

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
  /** Cambia al cambiar de trabajo para resetear el gesto. */
  resetKey?:      string;
  /** Cupo de chambas activas lleno: solo ver en radar, no postular. */
  disabled?:      boolean;
  disabledLabel?: string;
}

type GestureEvent = {
  nativeEvent: {
    pageX?: number;
    locationX?: number;
    touches?: { pageX: number }[];
  };
};

export const SwipeAcceptTrack: React.FC<SwipeAcceptTrackProps> = ({
  onAccept,
  isLoading = false,
  isAccepted = false,
  isInProcess = false,
  onInProcess,
  label = 'Desliza para aceptar',
  successLabel = '¡Aceptado!',
  processLabel = 'En proceso',
  resetKey,
  disabled = false,
  disabledLabel = 'Finalizá una chamba en Agenda para postularte',
}) => {
  if (disabled) {
    return (
      <View style={styles.disabledBox}>
        <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
        <Text style={styles.disabledText} numberOfLines={2}>
          {disabledLabel}
        </Text>
      </View>
    );
  }

  const [trackWidth, setTrackWidth] = useState(0);
  const [phase, setPhase] = useState<SwipePhase>(() => {
    if (isInProcess) return 'in_process';
    if (isAccepted) return 'accepted';
    return 'idle';
  });

  const translateX = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const dragX = useRef(0);
  const dragStartRef = useRef(0);
  const maxTravelRef = useRef(0);
  const phaseRef = useRef<SwipePhase>(phase);
  const pointerStart = useRef(0);
  const isPointerDown = useRef(false);
  const trackLeftRef = useRef(0);
  const trackRef = useRef<View>(null);
  const acceptingRef = useRef(false);

  maxTravelRef.current = Math.max(0, trackWidth - THUMB_SIZE);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const hardReset = useCallback(() => {
    translateX.setValue(0);
    textOpacity.setValue(1);
    progressWidth.setValue(0);
    dragX.current = 0;
    dragStartRef.current = 0;
    acceptingRef.current = false;
    isPointerDown.current = false;
  }, [translateX, textOpacity, progressWidth]);

  const snapBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, useNativeDriver: false, tension: 140, friction: 12 }),
      Animated.timing(textOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(progressWidth, { toValue: 0, duration: 180, useNativeDriver: false }),
    ]).start(() => {
      dragX.current = 0;
      dragStartRef.current = 0;
    });
  }, [translateX, textOpacity, progressWidth]);

  useEffect(() => {
    if (isInProcess) {
      setPhase('in_process');
      hardReset();
    } else if (isAccepted && phaseRef.current !== 'loading') {
      setPhase('accepted');
    }
  }, [isAccepted, isInProcess, hardReset]);

  useEffect(() => {
    if (isLoading && phaseRef.current === 'idle') {
      setPhase('loading');
    }
    if (!isLoading && phaseRef.current === 'loading' && !isAccepted && !isInProcess) {
      setPhase('idle');
      snapBack();
    }
  }, [isLoading, isAccepted, isInProcess, snapBack]);

  useEffect(() => {
    if (!resetKey) return;
    if (phaseRef.current === 'idle' || phaseRef.current === 'loading') {
      setPhase('idle');
      snapBack();
    }
  }, [resetKey, snapBack]);

  const applyDragPosition = useCallback((x: number) => {
    const max = maxTravelRef.current;
    if (max <= 0) return;
    const clamped = Math.max(0, Math.min(x, max));
    dragX.current = clamped;
    translateX.setValue(clamped);
    progressWidth.setValue(clamped + THUMB_SIZE);
    textOpacity.setValue(1 - clamped / max);
  }, [translateX, textOpacity, progressWidth]);

  const runAcceptFlow = useCallback(async () => {
    if (phaseRef.current !== 'idle' || acceptingRef.current) return;
    acceptingRef.current = true;
    setPhase('loading');

    const max = maxTravelRef.current;
    Animated.parallel([
      Animated.timing(translateX, { toValue: max, duration: 220, useNativeDriver: false }),
      Animated.timing(progressWidth, { toValue: max + THUMB_SIZE, duration: 220, useNativeDriver: false }),
      Animated.timing(textOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    try {
      await Promise.resolve(onAccept());
      setPhase('accepted');
      setTimeout(() => {
        setPhase('in_process');
        onInProcess?.();
      }, 1200);
    } catch {
      setPhase('idle');
      acceptingRef.current = false;
      snapBack();
    }
  }, [onAccept, onInProcess, snapBack, translateX, progressWidth, textOpacity]);

  const onDragEnd = useCallback((allowTapAccept = false) => {
    if (phaseRef.current !== 'idle') return;
    const max = maxTravelRef.current;
    if (max <= 0) return;

    if (dragX.current >= max * SWIPE_THRESHOLD) {
      void runAcceptFlow();
    } else if (allowTapAccept && dragX.current <= TAP_MOVE_THRESHOLD) {
      void runAcceptFlow();
    } else {
      snapBack();
    }
  }, [runAcceptFlow, snapBack]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () =>
        phaseRef.current === 'idle' && maxTravelRef.current > 0,
      onMoveShouldSetPanResponder: (_, g) =>
        phaseRef.current === 'idle' &&
        maxTravelRef.current > 0 &&
        (Math.abs(g.dx) > 3 || Math.abs(g.dy) < Math.abs(g.dx)),
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          dragStartRef.current = value;
          dragX.current = value;
        });
      },
      onPanResponderMove: (_, g) => {
        applyDragPosition(dragStartRef.current + g.dx);
      },
      onPanResponderRelease: () => onDragEnd(false),
      onPanResponderTerminate: () => snapBack(),
    }),
    [applyDragPosition, onDragEnd, snapBack, translateX],
  );

  const readPageX = useCallback((e: GestureEvent): number => {
    const ne = e.nativeEvent;
    if (typeof ne.pageX === 'number') return ne.pageX;
    if (ne.touches?.length) return ne.touches[0].pageX;
    return trackLeftRef.current + (ne.locationX ?? 0);
  }, []);

  const measureTrack = useCallback(() => {
    if (Platform.OS !== 'web' || !trackRef.current) return;
    const node = trackRef.current as View & {
      measureInWindow?: (cb: (x: number) => void) => void;
    };
    node.measureInWindow?.((x: number) => {
      trackLeftRef.current = x;
    });
  }, []);

  const beginGesture = useCallback((pageX: number) => {
    if (phaseRef.current !== 'idle' || maxTravelRef.current <= 0) return;
    measureTrack();
    isPointerDown.current = true;
    pointerStart.current = pageX;
    dragStartRef.current = dragX.current;
  }, [measureTrack]);

  const moveGesture = useCallback((pageX: number) => {
    if (!isPointerDown.current) return;
    applyDragPosition(dragStartRef.current + (pageX - pointerStart.current));
  }, [applyDragPosition]);

  const endGesture = useCallback(() => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    onDragEnd(Platform.OS === 'web');
  }, [onDragEnd]);

  const webGestureHandlers = Platform.OS === 'web' ? {
    onPointerDown: (e: GestureEvent & { preventDefault?: () => void }) => {
      e.preventDefault?.();
      beginGesture(readPageX(e));
    },
    onPointerMove: (e: GestureEvent & { preventDefault?: () => void }) => {
      if (!isPointerDown.current) return;
      e.preventDefault?.();
      moveGesture(readPageX(e));
    },
    onPointerUp: () => endGesture(),
    onPointerCancel: () => {
      isPointerDown.current = false;
      snapBack();
    },
    onTouchStart: (e: GestureEvent) => {
      beginGesture(readPageX(e));
    },
    onTouchMove: (e: GestureEvent & { preventDefault?: () => void }) => {
      if (!isPointerDown.current) return;
      e.preventDefault?.();
      moveGesture(readPageX(e));
    },
    onTouchEnd: () => endGesture(),
  } : {};

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
    measureTrack();
  };

  if (phase === 'in_process' || isInProcess) {
    return (
      <View style={[styles.track, styles.trackProcess]}>
        <View style={styles.stateIconWrap}>
          <Ionicons name="time" size={20} color={CHAMBA.blue} />
        </View>
        <View style={styles.stateTextWrap}>
          <Text style={styles.processText}>{processLabel}</Text>
          <Text style={styles.processHint}>Ver en Agenda</Text>
        </View>
        <Ionicons name="receipt-outline" size={20} color={CHAMBA.muted} />
      </View>
    );
  }

  if (phase === 'accepted') {
    return (
      <View style={[styles.track, styles.trackSuccess]}>
        <View style={[styles.stateIconWrap, styles.stateIconSuccess]}>
          <Ionicons name="checkmark" size={20} color="#FFF" />
        </View>
        <Text style={styles.successText}>{successLabel}</Text>
      </View>
    );
  }

  if (phase === 'loading' || isLoading) {
    return (
      <View style={[styles.track, styles.trackLoading]}>
        <ActivityIndicator color={CHAMBA.blue} />
        <Text style={styles.labelLoading}>Procesando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View
        ref={trackRef}
        style={styles.track}
        onLayout={onLayout}
        {...(Platform.OS !== 'web' ? panResponder.panHandlers : webGestureHandlers)}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.progressFill, { width: progressWidth }]}
        >
          <LinearGradient
            colors={['rgba(0,229,255,0.35)', 'rgba(59,130,246,0.25)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Animated.Text style={[styles.label, { opacity: textOpacity }]}>
            {label}
          </Animated.Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={CHAMBA.muted}
            style={styles.labelChevron}
          />
        </View>

        <Animated.View
          style={[styles.thumbOuter, { transform: [{ translateX }] }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[...GRADIENT_TOGGLE]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.thumb}
          >
            <Ionicons name="arrow-forward" size={22} color="#FFF" />
          </LinearGradient>
        </Animated.View>
      </View>

      <Pressable
        onPress={() => void runAcceptFlow()}
        style={styles.tapFallback}
        accessibilityRole="button"
        accessibilityLabel="Aceptar trabajo"
        hitSlop={8}
      >
        <Text style={styles.tapFallbackText}>Toca aquí para aceptar</Text>
      </Pressable>
    </View>
  );
};

const webTrackStyle = Platform.OS === 'web'
  ? ({
      cursor: 'grab',
      userSelect: 'none',
      touchAction: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    } as Record<string, string>)
  : {};

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  track: {
    height:          THUMB_SIZE,
    borderRadius:    THUMB_SIZE / 2,
    backgroundColor: CHAMBA.toggleBg,
    justifyContent:  'center',
    alignItems:      'center',
    overflow:        'hidden',
    position:        'relative',
    borderWidth:     1,
    borderColor:     CHAMBA.border,
    ...webTrackStyle,
  },
  progressFill: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    borderRadius:    THUMB_SIZE / 2,
    overflow:        'hidden',
  },
  trackSuccess: {
    flexDirection:   'row',
    gap:             10,
    backgroundColor: '#ECFDF5',
    borderColor:     '#A7F3D0',
    paddingHorizontal: 14,
  },
  trackProcess: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    backgroundColor: '#EFF6FF',
    borderColor:     '#BFDBFE',
    paddingHorizontal: 14,
    justifyContent:  'flex-start',
  },
  trackLoading: {
    flexDirection: 'row',
    gap:           10,
  },
  label: {
    fontSize:   15,
    fontWeight: '600',
    color:      CHAMBA.blue,
    letterSpacing: 0.2,
  },
  labelChevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -8,
    opacity: 0.5,
  },
  labelLoading: {
    fontSize:   15,
    fontWeight: '600',
    color:      CHAMBA.blue,
  },
  successText: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#059669',
  },
  processText: {
    fontSize:   15,
    fontWeight: '700',
    color:      CHAMBA.navy,
  },
  processHint: {
    fontSize:   12,
    fontWeight: '500',
    color:      CHAMBA.muted,
    marginTop:  1,
  },
  stateTextWrap: {
    flex: 1,
  },
  stateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIconSuccess: {
    backgroundColor: '#10B981',
  },
  thumbOuter: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 2,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  thumb: {
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    borderRadius:    THUMB_SIZE / 2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  tapFallback: {
    alignSelf:       'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight:       36,
    justifyContent:  'center',
  },
  tapFallbackText: {
    fontSize:   13,
    fontWeight: '600',
    color:      CHAMBA.blue,
    textDecorationLine: 'underline',
  },
  disabledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  disabledText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 18,
  },
});
