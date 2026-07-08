import React from 'react';
import { useState, useCallback } from 'react';
const _keepReact = React;
import {
  View, Text, TouchableOpacity,
  Alert, StyleSheet, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChambaScreenHeader } from '@components/chamba/ChambaScreenHeader';
import { ChambaMenuRow } from '@components/chamba/ChambaMenuRow';
import { AdminMetricCard } from '@components/admin/AdminMetricCard';
import { chambaStyles } from '@constants/chambaUI';
import { AvailabilitySelector } from '@components/AvailabilitySelector';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { useWorkerProfile } from '../hooks/useWorkerProfile';
import { useWorkerJobs } from '../hooks/useWorkerJobs';
import { useWorkerReviews } from '@features/reviews/hooks/useWorkerReviews';

import { WorkerHeader } from '../components/static/WorkerHeader';
import { LiveTelemetryOverlay } from '../components/live/LiveTelemetryOverlay';
import { JobsList } from '../components/lists/JobsList';
import { ReviewsList } from '../components/lists/ReviewsList';

import { uploadAvatar, updateProfile } from '@features/auth/services/authService';
import { DeleteAccountModal } from '@features/account/components/DeleteAccountModal';
import { WorkerWalletCard } from '@components/worker/WorkerWalletCard';

import type { ProfileStackParamList, WorkerTabParamList, JobCategory, JobAssignment, AvailabilityStatus } from '@/types';
import { M3, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/stitchStyles';
import { formatCurrency, getCategoryLabel } from '@utils/formatters';
import { isWorkerCommitmentActive, isWorkerPendingClientSelection } from '@utils/jobActiveLimits';
import { LEGAL_LINKS, APP_VERSION_LABEL, openLegalLink } from '@constants/legalLinks';

const CATEGORY_ICONS: Partial<Record<JobCategory, keyof typeof Ionicons.glyphMap>> = {
  limpieza_sofas: 'water-outline',
  limpieza_alfombra: 'water-outline',
  alfombra_institucional: 'business-outline',
  fumigacion: 'bug-outline',
  vehiculo_limpieza_profunda: 'car-outline',
  vehiculo_lavado_regular: 'car-outline',
  conserjeria_ocasional: 'time-outline',
  conserjeria_contrato: 'document-text-outline',
  b2b_personal_operativo: 'cube-outline',
  b2b_mesero_barman: 'wine-outline',
  b2b_ayudante_cocina: 'restaurant-outline',
  b2b_apoyo_hogar: 'home-outline',
  b2b_conserje_empresa: 'brush-outline',
  b2b_otro_servicio: 'ellipsis-horizontal-outline',
  jardineria: 'leaf-outline',
};

const SectionTitle: React.FC<{ label: string; subtitle?: string }> = ({ label, subtitle }) => (
  <View style={chambaStyles.sectionHeader}>
    <Text style={chambaStyles.sectionTitle}>{label}</Text>
    {subtitle ? <Text style={chambaStyles.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

const ServiceRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  last?: boolean;
}> = ({ icon, label, active, last }) => (
  <View style={[styles.serviceRow, !last && styles.serviceRowBorder]}>
    <View style={styles.serviceRowLeft}>
      <View style={styles.serviceIconWrap}>
        <Ionicons name={icon} size={20} color={M3.primary} />
      </View>
      <View>
        <Text style={styles.serviceLabel}>{label}</Text>
        <Text style={[styles.serviceStatus, !active && styles.serviceStatusPaused]}>
          {active ? 'Activo' : 'Pausado'}
        </Text>
      </View>
    </View>
    <View style={[styles.statusPill, active ? styles.statusPillActive : styles.statusPillPaused]}>
      <View style={[styles.statusDot, { backgroundColor: active ? M3.secondary : M3.outline }]} />
      <Text style={[styles.statusPillText, active ? styles.statusPillTextActive : styles.statusPillTextPaused]}>
        {active ? 'Activo' : 'Pausado'}
      </Text>
    </View>
  </View>
);

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<WorkerTabParamList>>();

  const [activeTab, setActiveTab] = useState<'jobs' | 'reviews'>('jobs');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const {
    profile,
    workerProfile,
    stats,
    isTogglingAvail,
    setAvailability,
    setProfile,
    signOut,
    refreshProfile,
  } = useWorkerProfile();

  const {
    myJobs,
    walletSummary,
    refreshJobs,
    isLoadingJobs,
  } = useWorkerJobs();

  const { reviews, isLoading: isLoadingReviews } = useWorkerReviews(profile?.id || '');

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      void refreshJobs();
    }, [refreshProfile, refreshJobs])
  );

  const handlePickAvatar = async () => {
    if (!profile) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const localUri = result.assets[0].uri;
    setAvatarPreview(localUri);
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(profile.id, localUri);
      setProfile({ ...profile, avatar_url: url });
      setAvatarPreview(url);
      try {
        await updateProfile(profile.id, { avatar_url: url });
      } catch (updateErr: any) {
        console.warn('[Profile] avatar_url no guardado en Supabase:', updateErr.message);
      }
    } catch (err: any) {
      setAvatarPreview(null);
      Alert.alert('Error al subir foto', err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (confirm('¿Seguro que quieres cerrar sesión?')) signOut();
      return;
    }
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: signOut },
      ],
    );
  };

  const scrollToReviews = useCallback(() => {
    setActiveTab('reviews');
  }, []);

  if (!profile) return null;

  const currentAvailability: AvailabilityStatus =
    workerProfile?.availability_status === 'available' ||
    workerProfile?.availability_status === 'busy' ||
    workerProfile?.availability_status === 'offline'
      ? workerProfile.availability_status
      : 'offline';

  const acceptedCount = myJobs.filter((a: JobAssignment) =>
    a.selection_status !== 'rejected' && (
      isWorkerCommitmentActive(a)
      || isWorkerPendingClientSelection(a)
      || a.job?.status === 'completed'
    ),
  ).length || (stats?.acceptedJobs ?? 0);
  const earnedTotal = walletSummary.totalAvailable;
  const completedCount = walletSummary.completedCount;

  const specialties: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean }[] = [];
  if (profile.category_1) {
    specialties.push({
      id: 'cat1',
      label: getCategoryLabel(profile.category_1),
      icon: CATEGORY_ICONS[profile.category_1] ?? 'construct-outline',
      active: profile.category_1_approved,
    });
  }
  if (profile.category_2) {
    specialties.push({
      id: 'cat2',
      label: getCategoryLabel(profile.category_2),
      icon: CATEGORY_ICONS[profile.category_2] ?? 'construct-outline',
      active: profile.category_2_approved,
    });
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <WorkerHeader 
        profile={profile}
        workerProfile={workerProfile}
        uploadingAvatar={uploadingAvatar}
        avatarPreview={avatarPreview}
        onPickAvatar={handlePickAvatar}
        onScrollToReviews={scrollToReviews}
      />

      {!profile.is_approved && (
        <View style={styles.pendingBanner}>
          <Ionicons name="information-circle-outline" size={18} color={M3.tertiary} />
          <Text style={styles.pendingBannerText}>
            Un administrador revisará tu perfil. Recibirás una notificación cuando
            estés habilitado para aceptar chambas.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <SectionTitle label="Disponibilidad" subtitle="Tu estado para recibir chambas" />
        <View style={chambaStyles.panelCard}>
          <AvailabilitySelector
            current={currentAvailability}
            onChange={(status) => setAvailability(profile.id, status)}
            isLoading={isTogglingAvail}
            disabled={false}
          />
        </View>
        {!profile.is_approved && (
          <Text style={styles.disabledHint}>
            Tu cuenta está pendiente — podrás aceptar chambas cuando seas aprobado
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle label="Billetera" subtitle="Mismas ganancias que la pestaña Billetera" />
        <WorkerWalletCard summary={walletSummary} />
        <TouchableOpacity
          style={styles.walletLink}
          onPress={() => tabNavigation?.navigate('Wallet')}
          activeOpacity={0.8}
        >
          <Text style={styles.walletLinkText}>Ver detalle y gráfico</Text>
          <Ionicons name="chevron-forward" size={16} color={M3.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <SectionTitle label="Resumen" subtitle="Métricas de tu actividad" />
        <View style={styles.bentoGrid}>
          <View style={styles.bentoRow}>
            <AdminMetricCard
              icon="work"
              label="Chambas aceptadas"
              value={String(acceptedCount)}
              accent="#007AFF"
            />
            <AdminMetricCard
              icon="payments"
              label="Total ganado"
              value={formatCurrency(earnedTotal)}
              accent="#34C759"
            />
          </View>
          <View style={styles.bentoRow}>
            <AdminMetricCard
              icon="star"
              label="Calificación"
              value={workerProfile?.rating_avg ? workerProfile.rating_avg.toFixed(1) : '✨'}
              accent="#FF9500"
            />
            <AdminMetricCard
              icon="task_alt"
              label="Completadas"
              value={String(completedCount)}
              accent="#5856D6"
            />
          </View>
        </View>
      </View>

      {(specialties.length > 0 || (workerProfile?.skills?.length ?? 0) > 0) && (
        <View style={styles.section}>
          <SectionTitle label="Mis especialidades" subtitle="Categorías aprobadas" />
          <View style={chambaStyles.panelCard}>
            {specialties.map((svc, idx) => (
              <ServiceRow
                key={svc.id}
                icon={svc.icon}
                label={svc.label}
                active={svc.active}
                last={idx === specialties.length - 1 && (workerProfile?.skills?.length ?? 0) === 0}
              />
            ))}
            {(workerProfile?.skills ?? []).map((skill, idx) => (
              <View
                key={skill}
                style={[
                  styles.serviceRow,
                  idx < (workerProfile!.skills.length - 1) && styles.serviceRowBorder,
                ]}
              >
                <View style={styles.serviceRowLeft}>
                  <View style={styles.serviceIconWrap}>
                    <Ionicons name="construct-outline" size={20} color={M3.primary} />
                  </View>
                  <View>
                    <Text style={styles.serviceLabel}>{skill}</Text>
                    <Text style={styles.serviceStatus}>Habilidad</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {workerProfile?.bio && (
        <View style={styles.section}>
          <SectionTitle label="Sobre mí" />
          <View style={chambaStyles.panelCard}>
            <Text style={styles.bioText}>{workerProfile.bio}</Text>
          </View>
        </View>
      )}

      {/* Tabs Selector for FlatList Content */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'jobs' && styles.tabButtonActive]}
          onPress={() => setActiveTab('jobs')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'jobs' && styles.tabTextActive]}>Historial de Trabajos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'reviews' && styles.tabButtonActive]}
          onPress={() => setActiveTab('reviews')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>Reseñas de Clientes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      <View style={styles.section}>
        <SectionTitle label="Cuenta" subtitle="Contacto y verificación" />
        <ChambaMenuRow
          title="Correo electrónico"
          subtitle={profile.email ?? '—'}
          iconColor="#007AFF"
          icon={<Ionicons name="mail" size={22} color="#FFF" />}
        />
        <ChambaMenuRow
          title="Teléfono"
          subtitle={profile.phone ?? 'No registrado'}
          iconColor="#34C759"
          icon={<Ionicons name="call" size={22} color="#FFF" />}
        />
        <ChambaMenuRow
          title="Cerrar sesión"
          subtitle="Salir de tu cuenta de forma segura"
          iconColor="#FF453A"
          icon={<Ionicons name="log-out-outline" size={22} color="#FFF" />}
          onPress={handleSignOut}
          destructive
        />
        <ChambaMenuRow
          title="Eliminar cuenta"
          subtitle="Borrar tu cuenta y tus datos de forma permanente"
          iconColor="#DC2626"
          icon={<Ionicons name="trash-outline" size={22} color="#FFF" />}
          onPress={() => setShowDeleteAccount(true)}
          destructive
        />
      </View>

      <View style={styles.section}>
        <SectionTitle label="Información legal" subtitle="Políticas, normas y soporte" />
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
      </View>

      <Text style={styles.versionText}>{APP_VERSION_LABEL}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[chambaStyles.screen, styles.root]} edges={['top']}>
      <LiveTelemetryOverlay />
      
      <ChambaScreenHeader
        title="Mi Perfil"
        subtitle="Tu cuenta, métricas y especialidades"
      />

      {activeTab === 'jobs' ? (
        <JobsList 
          jobs={myJobs} 
          isLoading={isLoadingJobs} 
          ListHeaderComponent={renderHeader()}
          ListFooterComponent={renderFooter()}
        />
      ) : (
        <ReviewsList
          reviews={reviews}
          isLoading={isLoadingReviews}
          ListHeaderComponent={renderHeader()}
          ListFooterComponent={renderFooter()}
        />
      )}

      <DeleteAccountModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerContainer: {
    gap: 16,
    marginBottom: SPACING.md,
  },
  footerContainer: {
    marginTop: SPACING.lg,
    gap: 16,
  },
  section: { gap: 4 },
  bentoGrid: { gap: 10, marginBottom: 4 },
  bentoRow: { flexDirection: 'row', gap: 10 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: M3.tertiaryFixed,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: M3.tertiaryFixedDim,
  },
  pendingBannerText: {
    flex: 1,
    color: M3.onTertiaryFixedVariant,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  disabledHint: {
    color: M3.outline,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  serviceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: M3.surfaceVariant,
  },
  serviceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 4,
    flex: 1,
  },
  serviceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: M3.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: M3.onBackground,
  },
  serviceStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: M3.onSurfaceVariant,
    marginTop: 2,
  },
  serviceStatusPaused: {
    color: M3.outline,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillActive: {
    backgroundColor: M3.secondaryFixed,
  },
  statusPillPaused: {
    backgroundColor: M3.surfaceContainerHigh,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextActive: {
    color: M3.onSecondaryContainer,
  },
  statusPillTextPaused: {
    color: M3.outline,
  },
  bioText: {
    color: M3.onSurfaceVariant,
    fontSize: 16,
    lineHeight: 24,
    padding: SPACING.md,
  },
  versionText: {
    color: '#888',
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    marginTop: 4,
  },
  walletLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 8,
  },
  walletLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: M3.primary,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: M3.surfaceContainerHighest,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    marginTop: SPACING.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  tabButtonActive: {
    backgroundColor: M3.primary,
    ...chambaStyles.shadowSm,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: M3.onSurfaceVariant,
  },
  tabTextActive: {
    color: M3.onPrimary,
  },
  skeletonContainer: {
    paddingVertical: SPACING.sm,
  },
  emptyContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: M3.surfaceVariant,
    borderRadius: 12,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: 15,
    color: M3.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
});
