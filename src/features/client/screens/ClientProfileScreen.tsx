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
import { CHAMBA, chambaStyles, CARD_STEP_SHADOW } from '@constants/chambaUI';
import { webMinViewportStyle } from '@constants/webMobileLayout';
import { openWhatsAppSupport } from '@utils/whatsappSupport';
import { LEGAL_LINKS, APP_VERSION_LABEL, openLegalLink } from '@constants/legalLinks';
import { StarRating } from '@components/StarRating';
import { useWorkerReviews } from '@features/reviews/hooks/useWorkerReviews';
import { ReviewCard } from '@features/workers/components/static/ReviewCard';
import { useSupportBubbleScrollHandlers } from '@hooks/useSupportBubbleScrollHandlers';
import { pickProfileAvatarUri, showProfileAvatarError } from '@utils/profileAvatarPicker';
import { uploadAvatar, updateProfile } from '@features/auth/services/authService';
import { DeleteAccountModal } from '@features/account/components/DeleteAccountModal';
import type { ClientTabParamList, WorkerReview } from '@/types';

type TabNav = BottomTabNavigationProp<ClientTabParamList>;

export const ClientProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<TabNav>();
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const supportBubbleScroll = useSupportBubbleScrollHandlers();
  const [signingOut, setSigningOut] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  // Reseñas recibidas por el cliente (mismo servicio/RPC que el técnico, por subject_id).
  const { reviews: clientReviews } = useWorkerReviews(profile?.id);

  const handlePickAvatar = useCallback(async () => {
    if (!profile?.id || uploadingAvatar) return;

    try {
      const localUri = await pickProfileAvatarUri();
      if (!localUri) return;

      setAvatarPreview(localUri);
      setUploadingAvatar(true);

      const url = await uploadAvatar(profile.id, localUri);
      setProfile({ ...profile, avatar_url: url });
      setAvatarPreview(url);

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

  // Aviso previo: evita aperturas accidentales del flujo de eliminación.
  const handleDeleteAccountPress = () => {
    const warning =
      'Estás por iniciar la eliminación de tu cuenta. Esta acción es permanente y borra tu perfil, historial y reputación.';
    if (Platform.OS === 'web') {
      if (confirm(`⚠️ ${warning}\n\n¿Querés continuar?`)) setShowDeleteAccount(true);
      return;
    }
    Alert.alert('⚠️ Eliminar cuenta', `${warning}\n\n¿Querés continuar?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Continuar', style: 'destructive', onPress: () => setShowDeleteAccount(true) },
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
        {...supportBubbleScroll}
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

        {(profile.total_reviews ?? 0) > 0 && (
          <>
            <View style={styles.reputationCard}>
              <StarRating
                rating={profile.rating_avg ?? 0}
                totalReviews={profile.total_reviews ?? 0}
                size="md"
              />
              <Text style={styles.reputationHint}>
                Calificación recibida de tus técnicos
              </Text>
            </View>

            {clientReviews.length > 0 && (
              <View style={styles.reviewsSection}>
                <View style={chambaStyles.sectionHeader}>
                  <Text style={chambaStyles.sectionTitle}>Reseñas recibidas</Text>
                  <Text style={chambaStyles.sectionSubtitle}>Lo que opinan los técnicos</Text>
                </View>
                {clientReviews.map((review: WorkerReview) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </View>
            )}
          </>
        )}

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

        <View style={chambaStyles.sectionHeader}>
          <Text style={chambaStyles.sectionTitle}>Información legal</Text>
          <Text style={chambaStyles.sectionSubtitle}>Políticas, normas y soporte</Text>
        </View>

        <ChambaMenuRow
          title="Política de Privacidad"
          subtitle="Cómo protegemos tus datos"
          iconColor="#0EA5E9"
          icon={<Ionicons name="shield-checkmark" size={22} color="#FFF" />}
          onPress={() => openLegalLink(LEGAL_LINKS.privacy)}
        />

        <ChambaMenuRow
          title="Términos y Condiciones"
          subtitle="Reglas de uso del servicio"
          iconColor="#6366F1"
          icon={<Ionicons name="document-text" size={22} color="#FFF" />}
          onPress={() => openLegalLink(LEGAL_LINKS.terms)}
        />

        <ChambaMenuRow
          title="Normas de la Comunidad"
          subtitle="Convivencia y buenas prácticas"
          iconColor="#8B5CF6"
          icon={<Ionicons name="people" size={22} color="#FFF" />}
          onPress={() => openLegalLink(LEGAL_LINKS.community)}
        />

        <ChambaMenuRow
          title="Política de Cancelaciones"
          subtitle="Condiciones para cancelar"
          iconColor="#F97316"
          icon={<Ionicons name="close-circle" size={22} color="#FFF" />}
          onPress={() => openLegalLink(LEGAL_LINKS.cancellations)}
        />

        <ChambaMenuRow
          title="Soporte / Contacto"
          subtitle="soporte@chamba.app"
          iconColor="#10B981"
          icon={<Ionicons name="mail" size={22} color="#FFF" />}
          onPress={() => openLegalLink(LEGAL_LINKS.support)}
        />

        <View style={chambaStyles.sectionHeader}>
          <Text style={chambaStyles.sectionTitle}>Sesión y cuenta</Text>
          <Text style={chambaStyles.sectionSubtitle}>Acciones sensibles</Text>
        </View>

        <ChambaMenuRow
          title={signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          subtitle={signingOut ? 'Un momento' : 'Salir de tu cuenta de forma segura'}
          iconColor="#FF453A"
          icon={<Ionicons name="log-out-outline" size={22} color="#FFF" />}
          onPress={signingOut ? undefined : handleSignOut}
          destructive
          loading={signingOut}
        />

        <ChambaMenuRow
          title="Eliminar cuenta"
          subtitle="Borrar tu cuenta y tus datos de forma permanente"
          iconColor="#DC2626"
          icon={<Ionicons name="trash-outline" size={22} color="#FFF" />}
          onPress={handleDeleteAccountPress}
          destructive
        />

        <Text style={styles.version}>{APP_VERSION_LABEL}</Text>
      </ScrollView>

      <DeleteAccountModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
      />
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
  reputationCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
    ...CARD_STEP_SHADOW,
  },
  reputationHint: {
    fontSize: 13,
    color: CHAMBA.muted,
    fontWeight: '500',
  },
  reviewsSection: {
    marginTop: 4,
  },
});
