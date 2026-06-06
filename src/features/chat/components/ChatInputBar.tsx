import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHAT_THEME } from '../constants/chatTheme';

interface Props {
  accentColor: string;
  readOnly?: boolean;
  isSending?: boolean;
  error?: string | null;
  onSend: (text: string) => void;
}

export const ChatInputBar: React.FC<Props> = ({
  accentColor,
  readOnly,
  isSending,
  error,
  onSend,
}) => {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !readOnly && !isSending;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || readOnly || isSending) return;
    onSend(trimmed);
    setText('');
  };

  if (readOnly) {
    return (
      <View style={[styles.lockedWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.lockedBanner}>
          <View style={styles.lockedIconWrap}>
            <Ionicons name="lock-closed" size={16} color={CHAT_THEME.muted} />
          </View>
          <Text style={styles.lockedText}>
            Conversación finalizada debido a la conclusión del servicio.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {!!error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={15} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Escribí un mensaje…"
          placeholderTextColor={CHAT_THEME.muted}
          multiline
          maxLength={2000}
          editable={!isSending}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={Platform.OS === 'web' ? undefined : handleSend}
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          style={[
            styles.sendBtn,
            canSend && { backgroundColor: accentColor },
            !canSend && styles.sendBtnDisabled,
          ]}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          accessibilityState={{ disabled: !canSend }}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="arrow-up" size={20} color={canSend ? '#FFF' : CHAT_THEME.muted} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  composer: {
    backgroundColor: CHAT_THEME.composerBg,
    borderTopWidth: 1,
    borderTopColor: CHAT_THEME.headerBorder,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    fontSize: 15,
    lineHeight: 20,
    color: CHAT_THEME.textPrimary,
    backgroundColor: CHAT_THEME.inputBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CHAT_THEME.border,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'web' ? 11 : 10,
    fontWeight: '400',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: CHAT_THEME.inputBg,
    borderWidth: 1,
    borderColor: CHAT_THEME.border,
  },
  lockedWrap: {
    backgroundColor: CHAT_THEME.composerBg,
    borderTopWidth: 1,
    borderTopColor: CHAT_THEME.headerBorder,
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: CHAT_THEME.lockedBannerBg,
    borderWidth: 1,
    borderColor: CHAT_THEME.lockedBannerBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: 420,
    width: '100%',
  },
  lockedIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CHAT_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedText: {
    flex: 1,
    fontSize: 13,
    color: CHAT_THEME.muted,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
  },
});
