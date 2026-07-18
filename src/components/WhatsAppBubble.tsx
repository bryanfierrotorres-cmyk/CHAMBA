import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity, Animated, StyleSheet,
  Platform, View, Text,
} from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { openWhatsAppSupport } from '@utils/whatsappSupport';
import { isJobChatRouteFocused, isCreateJobFormFocused } from '@utils/navigationFocus';
import { useSupportBubbleStore } from '@store/supportBubbleStore';

interface Props {
  /** Bottom offset — useful to clear the tab bar. Default 90 */
  bottom?: number;
  /** Right offset. Default 20 */
  right?: number;
}

export const WhatsAppBubble: React.FC<Props> = ({ bottom = 90, right = 20 }) => {
  const hiddenOnChat = useNavigationState(isJobChatRouteFocused);
  const hiddenOnCreateJobForm = useNavigationState(isCreateJobFormFocused);
  const hiddenByScroll = useSupportBubbleStore((s) => s.hiddenByScroll);
  const pulse = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const scrollHide = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Slide-in on mount
    Animated.spring(enter, {
      toValue: 1, friction: 6, tension: 80, useNativeDriver: true,
    }).start();

    // Continuous subtle pulse on the ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(scrollHide, {
      toValue: hiddenByScroll ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hiddenByScroll, scrollHide]);

  const openWhatsApp = () => {
    void openWhatsAppSupport();
  };

  if (hiddenOnChat || hiddenOnCreateJobForm) {
    return null;
  }

  const visibility = Animated.multiply(enter, scrollHide);

  return (
    <Animated.View
      pointerEvents={hiddenByScroll ? 'none' : 'box-none'}
      style={[
        styles.wrapper,
        { bottom, right },
        {
          opacity: visibility,
          transform: [
            { scale: visibility },
            {
              translateY: scrollHide.interpolate({
                inputRange: [0, 1],
                outputRange: [48, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Pulsing ring */}
      <Animated.View
        style={[styles.ring, { transform: [{ scale: pulse }] }]}
        pointerEvents="none"
      />

      <TouchableOpacity
        onPress={openWhatsApp}
        style={styles.bubble}
        activeOpacity={0.85}
        accessibilityLabel="Contactar soporte por WhatsApp"
        accessibilityRole="button"
      >
        {/* WhatsApp icon drawn with text to avoid extra library deps */}
        <Text style={styles.icon}>💬</Text>
      </TouchableOpacity>

      <View style={styles.label} pointerEvents="none">
        <Text style={styles.labelText}>Ayuda</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 9999,
    // web: ensure it floats above everything
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : {}),
  },

  ring: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(37,211,102,0.45)',
    top: -2,
  },

  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',   // official WhatsApp green
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },

  icon: { fontSize: 26, lineHeight: 30 },

  label: {
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  labelText: { color: '#FFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
});
