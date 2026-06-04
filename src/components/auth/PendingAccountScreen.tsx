import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/theme';
import type { UserRole } from '@/types';

interface PendingAccountScreenProps {
  role?: Extract<UserRole, 'client' | 'worker'>;
}

export const PendingAccountScreen: React.FC<PendingAccountScreenProps> = ({ role = 'client' }) => {
  const profile = useAuthStore((s) => s.profile);
  const { signOut } = useAuthStore();

  const title =
    role === 'client'
      ? 'Cuenta en revisión'
      : 'Revisando tus documentos';

  const subtitle =
    role === 'client'
      ? 'Tu cuenta de cliente está pendiente de aprobación. Te avisaremos cuando puedas solicitar servicios.'
      : 'Tus documentos están siendo revisados por administración. Te notificaremos pronto.';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bg.primary,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: BORDER_RADIUS.lg,
          backgroundColor: COLORS.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: SPACING.lg,
        }}
      >
        <Ionicons name="time-outline" size={44} color={COLORS.brand[500]} />
      </View>
      <Text
        style={{
          color: COLORS.text.primary,
          fontSize: FONT_SIZE['2xl'],
          fontWeight: '900',
          textAlign: 'center',
          marginBottom: SPACING.sm,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: COLORS.text.secondary,
          fontSize: FONT_SIZE.md,
          textAlign: 'center',
          lineHeight: 22,
        }}
      >
        {subtitle}
      </Text>
      <Text
        style={{
          color: COLORS.text.muted,
          fontSize: FONT_SIZE.sm,
          marginTop: SPACING.lg,
          textAlign: 'center',
        }}
      >
        Hola, {profile?.full_name?.split(' ')[0] ?? 'usuario'} 👋
      </Text>
      <Text
        onPress={signOut}
        style={{
          color: COLORS.brand[500],
          fontSize: FONT_SIZE.sm,
          fontWeight: '700',
          marginTop: SPACING.xl,
          textDecorationLine: 'underline',
        }}
      >
        Cerrar sesión
      </Text>
    </View>
  );
};
