import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CARD_STEP_SHADOW, CHAMBA, GRADIENT_TOGGLE } from '@constants/chambaUI';

export const CHAMBA_PUBLISH_SLOGAN =
  'Tu chamba ya está en el radar — Garantía CHAMBA en cada servicio';

interface ChambaPublishSuccessProps {
  visible: boolean;
  title?: string;
  message?: string;
  slogan?: string;
  onDismiss: () => void;
  autoHideMs?: number;
}

export const ChambaPublishSuccess: React.FC<ChambaPublishSuccessProps> = ({
  visible,
  title = '¡Solicitud publicada!',
  message = 'Los técnicos verificados ya pueden ver tu solicitud.',
  slogan = CHAMBA_PUBLISH_SLOGAN,
  onDismiss,
  autoHideMs = 2800,
}) => {
  const backdrop = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.88)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.6)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return undefined;

    backdrop.setValue(0);
    cardScale.setValue(0.88);
    cardOpacity.setValue(0);
    iconScale.setValue(0.6);

    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 16,
        bounciness: 7,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(80),
        Animated.spring(iconScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 14,
          bounciness: 8,
        }),
      ]),
    ]).start();

    dismissTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 0.94,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onDismiss();
      });
    }, autoHideMs);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [visible, autoHideMs, onDismiss, backdrop, cardScale, cardOpacity, iconScale]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable style={styles.pressableRoot} onPress={onDismiss}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
            <LinearGradient
              colors={[...GRADIENT_TOGGLE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Ionicons name="checkmark" size={36} color="#FFF" />
            </LinearGradient>
          </Animated.View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.divider} />

          <Text style={styles.slogan}>{slogan}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pressableRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: CHAMBA.white,
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...CARD_STEP_SHADOW,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrap: {
    marginBottom: 18,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CHAMBA.cyan,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: CHAMBA.navy,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    fontWeight: '400',
    color: CHAMBA.muted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  divider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: CHAMBA.cyan,
    marginTop: 20,
    marginBottom: 16,
    opacity: 0.85,
  },
  slogan: {
    fontSize: 13,
    fontWeight: '600',
    color: CHAMBA.blue,
    textAlign: 'center',
    lineHeight: 19,
    letterSpacing: 0.2,
  },
});
