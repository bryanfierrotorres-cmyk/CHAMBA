import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';

interface ChambaProfileHeroCardProps {
  avatarUri?: string | null;
  name: string;
  roleLabel: string;
  roleIcon?: keyof typeof Ionicons.glyphMap;
  roleIconColor?: string;
  meta?: string[];
  footer?: React.ReactNode;
  avatarSize?: number;
}

/** Tarjeta de identidad del perfil (avatar centrado + rol + metadatos). */
export const ChambaProfileHeroCard: React.FC<ChambaProfileHeroCardProps> = ({
  avatarUri,
  name,
  roleLabel,
  roleIcon,
  roleIconColor = CHAMBA.blue,
  meta = [],
  footer,
  avatarSize = 72,
}) => (
  <View style={styles.card}>
    <Avatar uri={avatarUri} name={name} size={avatarSize} />
    <Text style={styles.name}>{name}</Text>
    <View style={styles.rolePill}>
      {roleIcon ? <Ionicons name={roleIcon} size={14} color={roleIconColor} /> : null}
      <Text style={[styles.roleText, { color: roleIconColor }]}>{roleLabel}</Text>
    </View>
    {meta.map((line) => (
      <Text key={line} style={styles.meta}>{line}</Text>
    ))}
    {footer}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    ...CARD_STEP_SHADOW,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: CHAMBA.navy,
    marginTop: 14,
    letterSpacing: -0.3,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 8,
  },
  roleText: { fontWeight: '600', fontSize: 12 },
  meta: { fontSize: 14, color: CHAMBA.muted, marginTop: 6, fontWeight: '400' },
});
