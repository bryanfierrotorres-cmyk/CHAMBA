import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { CHAT_THEME, chatServiceBadgeStyle } from '../constants/chatTheme';

interface Props {
  name: string;
  avatarUrl?: string | null;
  serviceTitle: string;
  readOnly?: boolean;
  accentColor: string;
  onBack: () => void;
}

export const ChatHeader: React.FC<Props> = ({
  name,
  avatarUrl,
  serviceTitle,
  accentColor,
  onBack,
}) => {
  const badgeStyle = chatServiceBadgeStyle(accentColor);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={CHAT_THEME.textPrimary} />
      </TouchableOpacity>

      <View style={styles.avatarRing}>
        <Avatar uri={avatarUrl} name={name} size={44} />
      </View>

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={[styles.serviceBadge, badgeStyle]}>
          <Text style={[styles.serviceBadgeText, { color: accentColor }]} numberOfLines={1}>
            {serviceTitle}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: CHAT_THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_THEME.headerBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CHAT_THEME.border,
    padding: 2,
    marginRight: 12,
    backgroundColor: CHAT_THEME.surface,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: CHAT_THEME.navy,
    letterSpacing: -0.2,
  },
  serviceBadge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  serviceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
