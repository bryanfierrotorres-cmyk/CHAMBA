import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { CHAMBA } from '@constants/chambaUI';
import { useJobChat } from '../hooks/useJobChat';
import { ChatHeader } from '../components/ChatHeader';
import { ChatMessageBubble } from '../components/ChatMessageBubble';
import { ChatInputBar } from '../components/ChatInputBar';
import { ChatSkeleton } from '../components/ChatSkeleton';
import { groupMessagesForList } from '../utils/chatHelpers';
import { CHAT_THEME } from '../constants/chatTheme';
import type { JobChatStackParamList } from '@/types';

type ChatRoute = RouteProp<JobChatStackParamList, 'JobChat'>;

interface Props {
  accentColor?: string;
}

export const JobChatScreen: React.FC<Props> = ({ accentColor }) => {
  const route = useRoute<ChatRoute>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const listRef = useRef<FlatList>(null);

  const { jobId, readOnly: routeReadOnly } = route.params;
  const roleAccent =
    accentColor ??
    (profile?.role === 'worker' ? CHAT_THEME.workerAccent : CHAT_THEME.clientAccent);

  const {
    actorId,
    context,
    messages,
    isLoading,
    isError,
    readOnly,
    counterpart,
    send,
    sendTypingSignal,
    counterpartTyping,
    sendError,
    isSending,
  } = useJobChat(jobId);

  const listItems = useMemo(() => groupMessagesForList(messages), [messages]);
  const effectiveReadOnly = routeReadOnly ?? readOnly;

  useEffect(() => {
    if (listItems.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [listItems.length, messages.length]);

  const serviceTitle = context?.serviceTitle ?? 'Servicio CHAMBA';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ChatHeader
        name={counterpart?.name ?? 'Contacto'}
        avatarUrl={counterpart?.avatar}
        serviceTitle={serviceTitle}
        readOnly={effectiveReadOnly}
        accentColor={roleAccent}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
      >
        {isLoading ? (
          <ChatSkeleton />
        ) : isError || !context ? (
          <View style={styles.errorWrap}>
            <View style={styles.errorIcon}>
              <Ionicons name="cloud-offline-outline" size={32} color={CHAMBA.blue} />
            </View>
            <Text style={styles.errorTitle}>No se pudo cargar el chat</Text>
            <Text style={styles.errorSub}>
              Verificá tu conexión o que el servicio siga activo con técnico asignado.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={listItems}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              listItems.length === 0 && styles.listEmpty,
            ]}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              if (item.type === 'date') {
                return (
                  <View style={styles.dateWrap}>
                    <Text style={styles.dateLabel}>{item.dateLabel}</Text>
                  </View>
                );
              }
              const msg = item.message!;
              return (
                <ChatMessageBubble
                  message={msg}
                  isMine={msg.remitente_id === (actorId ?? profile?.id)}
                  accentColor={roleAccent}
                />
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIcon, { backgroundColor: `${roleAccent}18` }]}>
                  <Ionicons name="chatbubbles-outline" size={36} color={roleAccent} />
                </View>
                <Text style={styles.emptyTitle}>Iniciá la conversación</Text>
                <Text style={styles.emptySub}>
                  Coordiná horarios, accesos o detalles del servicio con{' '}
                  {counterpart?.name ?? 'tu contacto'}.
                </Text>
              </View>
            }
          />
        )}

        {counterpartTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>{counterpart?.name ?? 'Contacto'} está escribiendo...</Text>
          </View>
        )}

        <ChatInputBar
          accentColor={roleAccent}
          readOnly={effectiveReadOnly || isLoading || !context}
          isSending={isSending}
          error={sendError}
          onSend={send}
          onTyping={sendTypingSignal}
        />
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CHAT_THEME.bg,
  },
  flex: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  dateWrap: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CHAT_THEME.muted,
    backgroundColor: CHAT_THEME.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: CHAT_THEME.navy,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptySub: {
    fontSize: 14,
    color: CHAT_THEME.muted,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '400',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: CHAT_THEME.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CHAT_THEME.navy,
    marginBottom: 6,
  },
  errorSub: {
    fontSize: 14,
    color: CHAT_THEME.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: CHAT_THEME.bg,
  },
  typingText: {
    fontSize: 13,
    color: CHAT_THEME.muted,
    fontStyle: 'italic',
  },
});
