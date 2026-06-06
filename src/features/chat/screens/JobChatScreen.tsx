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
import { useAuthStore } from '@store/authStore';
import { CHAMBA } from '@constants/chambaUI';
import { M3 } from '@constants/workerTheme';
import { useJobChat } from '../hooks/useJobChat';
import { ChatHeader } from '../components/ChatHeader';
import { ChatMessageBubble } from '../components/ChatMessageBubble';
import { ChatInputBar } from '../components/ChatInputBar';
import { ChatSkeleton } from '../components/ChatSkeleton';
import { groupMessagesForList } from '../utils/chatHelpers';
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
    (profile?.role === 'worker' ? M3.primary : CHAMBA.blue);

  const {
    context,
    messages,
    isLoading,
    isError,
    readOnly,
    counterpart,
    send,
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {isLoading ? (
          <ChatSkeleton />
        ) : isError || !context ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorTitle}>No se pudo cargar el chat</Text>
            <Text style={styles.errorSub}>
              Verificá tu conexión o que el servicio siga activo.
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
                  isMine={msg.remitente_id === profile?.id}
                  accentColor={roleAccent}
                />
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>Sin mensajes aún</Text>
                <Text style={styles.emptySub}>
                  Coordiná detalles del servicio con {counterpart?.name ?? 'tu contacto'}.
                </Text>
              </View>
            }
          />
        )}

        <ChatInputBar
          accentColor={roleAccent}
          readOnly={effectiveReadOnly || isLoading || !context}
          isSending={isSending}
          error={sendError}
          onSend={send}
        />
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  flex: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingTop: 12,
    paddingBottom: 16,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
