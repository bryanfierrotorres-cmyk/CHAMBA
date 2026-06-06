import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CHAT_THEME } from '@features/chat/constants/chatTheme';
import { CARD_STEP_SHADOW } from '@constants/chambaUI';

interface Props {
  onPress: () => void;
  readOnly?: boolean;
  variant?: 'client' | 'worker';
  /** Fila completa bajo la tarjeta del pedido/chamba. */
  fullWidth?: boolean;
}

export const JobChatEntryButton: React.FC<Props> = ({
  onPress,
  readOnly = false,
  variant = 'client',
  fullWidth = false,
}) => {
  const accent = variant === 'worker' ? CHAT_THEME.workerAccent : CHAT_THEME.clientAccent;
  const title = readOnly ? 'Ver conversación' : 'Mensajes';
  const subtitle = readOnly
    ? 'Historial del servicio'
    : variant === 'worker'
      ? 'Coordiná con el cliente'
      : 'Coordiná con tu técnico';

  if (fullWidth) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.strip, { borderColor: `${accent}33` }, CARD_STEP_SHADOW]}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <View style={[styles.stripIcon, { backgroundColor: `${accent}18` }]}>
          <Ionicons name="chatbubbles" size={20} color={accent} />
        </View>
        <View style={styles.stripText}>
          <Text style={[styles.stripTitle, { color: CHAT_THEME.navy }]}>{title}</Text>
          <Text style={styles.stripSub}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={accent} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, { borderColor: `${accent}40` }]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Ionicons name="chatbubble-ellipses" size={16} color={accent} />
      <Text style={[styles.chipLabel, { color: accent }]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CHAT_THEME.surface,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  stripIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripText: { flex: 1, minWidth: 0 },
  stripTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stripSub: {
    fontSize: 12,
    color: CHAT_THEME.muted,
    marginTop: 2,
    fontWeight: '400',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: CHAT_THEME.surface,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
