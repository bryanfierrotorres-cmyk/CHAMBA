import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';

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
  readOnly,
  accentColor,
  onBack,
}) => (
  <View style={styles.wrap}>
    <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button">
      <Ionicons name="chevron-back" size={24} color="#111827" />
    </TouchableOpacity>

    <View style={[styles.avatarRing, { borderColor: `${accentColor}33` }]}>
      <Avatar uri={avatarUrl} name={name} size={40} />
    </View>

    <View style={styles.meta}>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <Text style={styles.service} numberOfLines={1}>{serviceTitle}</Text>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, readOnly && styles.statusDotMuted]} />
        <Text style={styles.statusText}>{readOnly ? 'Conversación cerrada' : 'Activo'}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  avatarRing: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 2,
    marginRight: 12,
  },
  meta: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  service: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  statusDotMuted: {
    backgroundColor: '#9CA3AF',
  },
  statusText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
});
