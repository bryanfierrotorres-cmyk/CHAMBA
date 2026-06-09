import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { ChambaScreenHeader } from '@components/chamba/ChambaScreenHeader';
import { ChambaProfileHeroCard } from '@components/chamba/ChambaProfileHeroCard';
import { ChambaMenuRow } from '@components/chamba/ChambaMenuRow';
import { CHAMBA, chambaStyles } from '@constants/chambaUI';
import { webMinViewportStyle } from '@constants/webMobileLayout';
import { openWhatsAppSupport } from '@utils/whatsappSupport';
import { pickProfileAvatarUri, showProfileAvatarError } from '@utils/profileAvatarPicker';
import { safePersistPilotProfile } from '@utils/pilotProfileStorage';
import { uploadAvatar, updateProfile } from '@features/auth/services/authService';
import type { ClientTabParamList } from '@/types';

type TabNav = BottomTabNavigationProp<ClientTabParamList>;

export const ClientProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<TabNav>();
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePickAvatar = useCallback(async () => {
    if (!profile?.id || uploadingAvatar) return;

    try {
      const localUri = await pickProfileAvatarUri();
      if (!localUri) return;

      setAvatarPreview(localUri);
      setUploadingAvatar(true);

      const url = await uploadAvatar(profile.id, localUri);
      const updatedProfile = { ...profile, avatar_url: url };

      setProfile(updatedProfile);
      setAvatarPreview(url);
      await safePersistPilotProfile(updatedProfile);

      try {
        await updateProfile(profile.id, { avatar_url: url });
      } catch (updateErr: unknown) {
        console.warn('[ClientProfile] avatar_url no guardado en Supabase:', updateErr);
      }
    } catch (err: unknown) {
      setAvatarPreview(null);
      showProfileAvatarError(err);
    } finally {
      setUploadingAvatar(false);
    }
  }, [profile, setProfile, uploadingAvatar]);

  const runSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      if (Platform.OS === 'web') {
        window.alert('No se pudo cerrar sesión. Recargá la página.');
      } else {
        Alert.alert('Error', 'No se pudo cerrar sesión. Intentá de nuevo.');
      }
    } finally {
      setSigningOut(false);
    }
  };

  const handleSignOut = () => {
    if (signingOut) return;
    if (Platform.OS === 'web') {
      if (confirm('¿Seguro que querés cerrar sesión?')) void runSignOut();
      return;
    }
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void runSignOut() },
    ]);
  };

  if (!profile) {
    return (
      <View style={[chambaStyles.screen, styles.center, webMinViewportStyle]}>
        <ActivityIndicator size="large" color={CHAMBA.blue} />
        <Text style={styles.loadingText}>
          {isLoading ? 'Cargando perfil…' : 'No hay sesión activa'}
        </Text>
      </View>
    );
  }

  const displayName = profile.full_name?.trim() || 'Cliente';
  const formattedPhone =
    profile.phone?.length === 8
      ? `${profile.phone.slice(0, 4)}-${profile.phone.slice(4)}`
      : profile.phone;
  const phoneLine = formattedPhone ? `+505 ${formattedPhone}` : undefined;
  const meta = [phoneLine, profile.email].filter(Boolean) as string[];

  return (
    <SafeAreaView style={[chambaStyles.screen, webMinViewportStyle]} edges={['top']}>
      <ChambaScreenHeader
        title="Mi Perfil"
        subtitle="Administrá tu cuenta y preferencias"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        <ChambaProfileHeroCard
          avatarUri={avatarPreview ?? profile.avatar_url}
          name={displayName}
          roleLabel="Cliente"
          roleIcon="person-circle-outline"
          roleIconColor={CHAMBA.teal}
          meta={meta}
          onAvatarPress={() => { void handlePickAvatar(); }}
          avatarUploading={uploadingAvatar}
        />

        <View style={chambaStyles.sectionHeader}>
          <Text style={chambaStyles.sectionTitle}>Cuenta</Text>
          <Text style={chambaStyles.sectionSubtitle}>Información y acciones</Text>
        </View>

        <ChambaMenuRow
          title="Datos personales"
          subtitle={phoneLine ?? 'Tu información de contacto'}
          iconColor="#007AFF"
          icon={<Ionicons name="person" size={22} color="#FFF" />}
        />

        <ChambaMenuRow
          title="Mis solicitudes"
          subtitle="Historial y servicios activos"
          iconColor="#5856D6"
          icon={<Ionicons name="document-text" size={22} color="#FFF" />}
          onPress={() => navigation.navigate('ClientOrders')}
        />

        <ChambaMenuRow
          title="Ayuda y soporte"
          subtitle="Contactanos por WhatsApp"
          iconColor="#34C759"
          icon={<Ionicons name="logo-whatsapp" size={22} color="#FFF" />}
          onPress={() => void openWhatsAppSupport()}
        />

        <ChambaMenuRow
          title={signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          subtitle={signingOut ? 'Un momento' : 'Salir de tu cuenta de forma segura'}
          iconColor="#FF453A"
          icon={<Ionicons name="log-out-outline" size={22} color="#FFF" />}
          onPress={signingOut ? undefined : handleSignOut}
          destructive
          loading={signingOut}
        />

        <Text style={styles.version}>CHAMBA · Solicitar servicios</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: CHAMBA.muted, fontWeight: '400' },
  scroll: { paddingHorizontal: 20 },
  version: {
    textAlign: 'center',
    color: CHAMBA.muted,
    fontSize: 12,
    marginTop: 8,
    fontWeight: '400',
  },
});
