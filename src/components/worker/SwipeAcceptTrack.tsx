import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, Animated, PanResponder, ActivityIndicator,
  StyleSheet, LayoutChangeEvent, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const THUMB_SIZE = 52;
const SWIPE_THRESHOLD = 0.55;

const DEEP_BLUE = '#1E293B';
const RAIL_BG = '#F3F4F6';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

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
  resetKey?:      string;
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
  successLabel = 'Aceptado',
  processLabel = 'En proceso',
  resetKey,
  disabled = false,
  disabledLabel = 'Finalizá una chamba en Agenda para postularte',
}) => {
  if (disabled) {
    return (
      <View style={styles.disabledBox}>
        <Ionicons name="lock-closed-outline" size={18} color={MUTED} />
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

  const onDragEnd = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    const max = maxTravelRef.current;
    if (max <= 0) return;

    if (dragX.current >= max * SWIPE_THRESHOLD) {
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
      onPanResponderRelease: () => onDragEnd(),
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
    onDragEnd();
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
          <Ionicons name="time-outline" size={18} color={DEEP_BLUE} />
        </View>
        <View style={styles.stateTextWrap}>
          <Text style={styles.processText}>{processLabel}</Text>
          <Text style={styles.processHint}>Ver en Agenda</Text>
        </View>
      </View>
    );
  }

  if (phase === 'accepted') {
    return (
      <View style={[styles.track, styles.trackSuccess]}>
        <View style={[styles.stateIconWrap, styles.stateIconSuccess]}>
          <Ionicons name="checkmark" size={18} color="#FFF" />
        </View>
        <Text style={styles.successText}>{successLabel}</Text>
      </View>
    );
  }

  if (phase === 'loading' || isLoading) {
    return (
      <View style={[styles.track, styles.trackLoading]}>
        <ActivityIndicator color={DEEP_BLUE} />
        <Text style={styles.labelLoading}>Procesando…</Text>
      </View>
    );
  }

  return (
    <View
      ref={trackRef}
      style={styles.track}
      onLayout={onLayout}
      {...(Platform.OS !== 'web' ? panResponder.panHandlers : webGestureHandlers)}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.progressFill, { width: progressWidth }]}
      />

      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.Text style={[styles.label, { opacity: textOpacity }]}>
          {label}
        </Animated.Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color="#9CA3AF"
          style={styles.labelChevron}
        />
      </View>

      <Animated.View
        style={[styles.thumbOuter, { transform: [{ translateX }] }]}
        pointerEvents="none"
      >
        <View style={styles.thumb}>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </View>
      </Animated.View>
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
  track: {
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: RAIL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: BORDER,
    ...webTrackStyle,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#E5E7EB',
  },
  trackSuccess: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderColor: BORDER,
    paddingHorizontal: 14,
  },
  trackProcess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderColor: BORDER,
    paddingHorizontal: 14,
    justifyContent: 'flex-start',
  },
  trackLoading: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.1,
  },
  labelChevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -7,
    opacity: 0.6,
  },
  labelLoading: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
  },
  successText: {
    fontSize: 14,
    fontWeight: '700',
    color: DEEP_BLUE,
  },
  processText: {
    fontSize: 14,
    fontWeight: '700',
    color: DEEP_BLUE,
  },
  processHint: {
    fontSize: 12,
    fontWeight: '500',
    color: MUTED,
    marginTop: 1,
  },
  stateTextWrap: {
    flex: 1,
  },
  stateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIconSuccess: {
    backgroundColor: DEEP_BLUE,
  },
  thumbOuter: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: DEEP_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: RAIL_BG,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  disabledText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    lineHeight: 18,
  },
});
