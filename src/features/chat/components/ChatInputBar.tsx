import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || readOnly || isSending) return;
    onSend(trimmed);
    setText('');
  };

  if (readOnly) {
    return (
      <View style={styles.readOnlyWrap}>
        <Text style={styles.readOnlyText}>
          El servicio fue finalizado. Podés leer el historial, pero ya no se pueden enviar mensajes.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Escribí un mensaje…"
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={2000}
          editable={!isSending}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || isSending}
          style={styles.sendBtn}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
        >
          {isSending ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Ionicons
              name="send"
              size={22}
              color={text.trim() ? accentColor : '#D1D5DB'}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
    paddingVertical: 8,
    fontWeight: '400',
  },
  sendBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyWrap: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  readOnlyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    fontWeight: '500',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
});
