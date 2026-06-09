import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
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
  onAvatarPress?: () => void;
  avatarUploading?: boolean;
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
  onAvatarPress,
  avatarUploading = false,
}) => {
  const avatarNode = (
    <>
      <Avatar uri={avatarUri} name={name} size={avatarSize} />
      {onAvatarPress && (
        <View style={styles.cameraBtn}>
          {avatarUploading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="camera" size={14} color="#FFF" />
          )}
        </View>
      )}
    </>
  );

  return (
    <View style={styles.card}>
      {onAvatarPress ? (
        <TouchableOpacity
          onPress={onAvatarPress}
          disabled={avatarUploading}
          activeOpacity={0.85}
          style={styles.avatarWrap}
        >
          {avatarNode}
        </TouchableOpacity>
      ) : (
        <View style={styles.avatarWrap}>{avatarNode}</View>
      )}
      {onAvatarPress && (
        <Text style={styles.avatarHint}>Tocá la foto para cambiarla</Text>
      )}
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
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    ...CARD_STEP_SHADOW,
  },
  avatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CHAMBA.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: CHAMBA.white,
  },
  avatarHint: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 10,
    fontWeight: '500',
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
