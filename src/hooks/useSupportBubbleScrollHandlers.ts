import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSupportBubbleStore } from '@store/supportBubbleStore';

/** Oculta el botón de Ayuda/WhatsApp mientras el usuario hace scroll. */
export function useSupportBubbleScrollHandlers() {
  const setHiddenByScroll = useSupportBubbleStore((s) => s.setHiddenByScroll);
  const showBubble = useSupportBubbleStore((s) => s.showBubble);
  const momentumActiveRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const hideBubble = useCallback(() => {
    clearShowTimer();
    setHiddenByScroll(true);
  }, [clearShowTimer, setHiddenByScroll]);

  const scheduleShowBubble = useCallback(() => {
    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      if (!momentumActiveRef.current) {
        showBubble();
      }
    }, 180);
  }, [clearShowTimer, showBubble]);

  useFocusEffect(
    useCallback(() => {
      showBubble();
      return () => {
        clearShowTimer();
        showBubble();
      };
    }, [clearShowTimer, showBubble]),
  );

  const onScroll = useCallback(
    (_event: NativeSyntheticEvent<NativeScrollEvent>) => {
      hideBubble();
    },
    [hideBubble],
  );

  const onScrollBeginDrag = useCallback(() => {
    hideBubble();
  }, [hideBubble]);

  const onScrollEndDrag = useCallback(() => {
    scheduleShowBubble();
  }, [scheduleShowBubble]);

  const onMomentumScrollBegin = useCallback(() => {
    momentumActiveRef.current = true;
    hideBubble();
  }, [hideBubble]);

  const onMomentumScrollEnd = useCallback(() => {
    momentumActiveRef.current = false;
    showBubble();
  }, [showBubble]);

  return {
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
    scrollEventThrottle: 16 as const,
  };
}
