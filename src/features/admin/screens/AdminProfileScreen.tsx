import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { Avatar } from '@components/Avatar';
import { M3, SPACING, BORDER_RADIUS, stitchTypography } from '@constants/stitchStyles';

export const AdminProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuthStore();

  if (!profile) return null;

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (confirm('¿Seguro que quieres cerrar sesión?')) void signOut();
      return;
    }
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg }]}
    >
      <View style={styles.card}>
        <Avatar uri={profile.avatar_url} name={profile.full_name} size={80} />
        <Text style={styles.name}>{profile.full_name}</Text>
        <View style={styles.rolePill}>
          <Ionicons name="shield-checkmark" size={16} color={M3.onPrimaryContainer} />
          <Text style={styles.roleText}>Administrador</Text>
        </View>
        {profile.email ? (
          <Text style={styles.meta}>{profile.email}</Text>
        ) : null}
        {profile.phone ? (
          <Text style={styles.meta}>{profile.phone}</Text>
        ) : null}
      </View>

      <TouchableOpacity onPress={handleSignOut} style={styles.signOut} activeOpacity={0.85}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={styles.version}>CHAMBA · Panel administrador</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: M3.background },
  content: { padding: SPACING.lg, paddingBottom: 120 },
  card: {
    alignItems: 'center',
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  name: { ...stitchTypography.headlineMd, color: M3.onBackground, marginTop: SPACING.sm },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: M3.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  roleText: { color: M3.onPrimaryContainer, fontWeight: '700', fontSize: 13 },
  meta: { color: M3.onSurfaceVariant, fontSize: 14 },
  signOut: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  signOutText: { color: M3.error, fontWeight: '700', fontSize: 16 },
  version: { textAlign: 'center', color: M3.onSurfaceVariant, fontSize: 12, marginTop: SPACING.lg },
});
