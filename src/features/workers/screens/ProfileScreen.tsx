import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
  StyleSheet, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { safePersistPilotProfile } from '@utils/pilotProfileStorage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@components/Avatar';
import { ChambaScreenHeader } from '@components/chamba/ChambaScreenHeader';
import { ChambaMenuRow } from '@components/chamba/ChambaMenuRow';
import { AdminMetricCard } from '@components/admin/AdminMetricCard';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import {
  AvailabilitySelector,
  AvailabilityBadge,
  AVAILABILITY_CONFIG,
} from '@components/AvailabilitySelector';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isPilotDocumentBypass } from '@constants/pilot';
import { useAuthStore }          from '@store/authStore';
import { useProfileStore }       from '@store/profileStore';
import type { ProfileStackParamList, JobCategory, JobAssignment } from '@/types';
import { uploadAvatar, updateProfile } from '@features/auth/services/authService';
import { subscribeToWorkerProfile }    from '../services/profileService';
import { WorkerReviewsPanel }          from '@features/reviews/components/WorkerReviewsPanel';
import { useMyJobs }                   from '@features/jobs/hooks/useJobs';
import { useWorkerWallet }             from '@features/jobs/hooks/useWorkerWallet';
import { WorkerWalletCard }            from '@components/worker/WorkerWalletCard';
import { computeWorkerWalletSummary }  from '@utils/workerWalletSummary';
import { isWorkerCommitmentActive, isWorkerPendingClientSelection } from '@utils/jobActiveLimits';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { WorkerTabParamList } from '@/types';
import { M3, FONT_SIZE, SPACING, BORDER_RADIUS, CARD_ELEVATION } from '@constants/stitchStyles';
import { formatCurrency, formatRatingAvg, getCategoryLabel } from '@utils/formatters';
import { ProfileSectionBoundary } from '@components/ProfileSectionBoundary';
import type { AvailabilityStatus } from '@/types';

const CATEGORY_ICONS: Partial<Record<JobCategory, keyof typeof Ionicons.glyphMap>> = {
  limpieza_sofas:         'water-outline',
  limpieza_alfombra:      'water-outline',
  alfombra_institucional: 'business-outline',
  fumigacion:             'bug-outline',
  vehiculo_limpieza_profunda: 'car-outline',
  vehiculo_lavado_regular:    'car-outline',
  conserjeria_ocasional:  'time-outline',
  conserjeria_contrato:   'document-text-outline',
  b2b_personal_operativo: 'cube-outline',
  b2b_mesero_barman:      'wine-outline',
  b2b_ayudante_cocina:    'restaurant-outline',
  b2b_apoyo_hogar:        'home-outline',
  b2b_conserje_empresa:   'brush-outline',
  b2b_otro_servicio:      'ellipsis-horizontal-outline',
  jardineria:             'leaf-outline',
};

const SectionTitle: React.FC<{ label: string; subtitle?: string }> = ({ label, subtitle }) => (
  <View style={chambaStyles.sectionHeader}>
    <Text style={chambaStyles.sectionTitle}>{label}</Text>
    {subtitle ? <Text style={chambaStyles.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

// ─── Service / specialty row (Stitch Mis Servicios) ─────────────────

const ServiceRow: React.FC<{
  icon:   keyof typeof Ionicons.glyphMap;
  label:  string;
  active: boolean;
  last?:  boolean;
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

// ─── Main screen ──────────────────────────────────────────────────

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const scrollRef = useRef<ScrollView>(null);
  const reviewsSectionY = useRef(0);
  const { profile, setProfile, signOut } = useAuthStore();
  const {
    workerProfile,
    stats,
    isTogglingAvail,
    loadProfile,
    loadStats,
    setAvailability,
    setWorkerProfile,
  } = useProfileStore();

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview]       = useState<string | null>(null);
  const [refreshing, setRefreshing]           = useState(false);
  const { data: myJobs = [] } = useMyJobs();
  const { data: walletEarnings = [], refetch: refetchWallet } = useWorkerWallet();
  const walletSummary = React.useMemo(
    () => computeWorkerWalletSummary(walletEarnings),
    [walletEarnings],
  );
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<WorkerTabParamList>>();

  const loadAll = async () => {
    if (!profile?.id) return;
    await Promise.all([
      loadProfile(profile.id),
      loadStats(profile.id),
      refetchWallet(),
    ]);
  };

  useEffect(() => {
    loadAll();
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
    }, [profile?.id]),
  );

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeToWorkerProfile(profile.id, setWorkerProfile);
    return () => { void unsub(); };
  }, [profile?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleAvailabilityChange = async (status: AvailabilityStatus) => {
    if (!profile?.id) return;
    try {
      await setAvailability(profile.id, status);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar la disponibilidad');
    }
  };

  const handlePickAvatar = async () => {
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
      const url = await uploadAvatar(profile!.id, localUri);
      const updatedProfile = { ...profile!, avatar_url: url };

      setProfile(updatedProfile);
      setAvatarPreview(url);

      await safePersistPilotProfile(updatedProfile);

      try {
        await updateProfile(profile!.id, { avatar_url: url });
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
      // eslint-disable-next-line no-restricted-globals
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

  const scrollToReviews = () => {
    scrollRef.current?.scrollTo({ y: reviewsSectionY.current, animated: true });
  };

  if (!profile) return null;

  const currentAvailability: AvailabilityStatus =
    workerProfile?.availability_status === 'available'
    || workerProfile?.availability_status === 'busy'
    || workerProfile?.availability_status === 'offline'
      ? workerProfile.availability_status
      : 'offline';
  const availCfg = AVAILABILITY_CONFIG[currentAvailability];
  const ratingDisplay = formatRatingAvg(workerProfile?.rating_avg);
  const reviewCount = workerProfile?.total_reviews ?? 0;

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
      id:     'cat1',
      label:  getCategoryLabel(profile.category_1),
      icon:   CATEGORY_ICONS[profile.category_1] ?? 'construct-outline',
      active: profile.category_1_approved,
    });
  }
  if (profile.category_2) {
    specialties.push({
      id:     'cat2',
      label:  getCategoryLabel(profile.category_2),
      icon:   CATEGORY_ICONS[profile.category_2] ?? 'construct-outline',
      active: profile.category_2_approved,
    });
  }

  return (
    <SafeAreaView style={[chambaStyles.screen, styles.root]} edges={['top']}>
      <ChambaScreenHeader
        title="Mi Perfil"
        subtitle="Tu cuenta, métricas y especialidades"
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={M3.primary}
          />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileGradient} />

          <TouchableOpacity
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={styles.avatarWrap}
          >
            <Avatar
              uri={avatarPreview ?? profile.avatar_url}
              name={profile.full_name}
              size={96}
              style={styles.avatarImg}
            />
            <View style={styles.cameraBtn}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color={M3.onPrimary} />
                : <Ionicons name="camera" size={14} color={M3.onPrimary} />
              }
            </View>
            <View style={[styles.availRing, { borderColor: availCfg.color }]} />
          </TouchableOpacity>

          <Text style={styles.profileName}>{profile.full_name}</Text>

          {profile.is_approved ? (
            <View style={styles.verifiedPill}>
              <Ionicons name="shield-checkmark" size={16} color={M3.onSecondaryContainer} />
              <Text style={styles.verifiedPillText}>Perfil Verificado</Text>
            </View>
          ) : (
            <View style={styles.pendingPill}>
              <Ionicons name="time-outline" size={16} color={M3.onTertiaryFixedVariant} />
              <Text style={styles.pendingPillText}>Pendiente de aprobación</Text>
            </View>
          )}

          <View style={{ marginTop: SPACING.sm }}>
            <AvailabilityBadge status={currentAvailability} />
          </View>

          {/* Rating bento */}
          <View style={styles.ratingBento}>
            <View style={styles.bentoTile}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={28} color={M3.tertiaryContainer} />
                <Text style={styles.ratingValue}>{ratingDisplay}</Text>
              </View>
              <Text style={styles.bentoLabel}>Calificación</Text>
            </View>
            <TouchableOpacity
              style={styles.bentoTile}
              onPress={scrollToReviews}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubbles-outline" size={28} color={M3.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.bentoValue, { color: M3.onBackground, fontSize: FONT_SIZE.lg }]}>
                {reviewCount}
              </Text>
              <Text style={styles.bentoLabel}>Comentarios</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Pending banner (detalle) ── */}
        {!profile.is_approved && (
          <View style={styles.pendingBanner}>
            <Ionicons name="information-circle-outline" size={18} color={M3.tertiary} />
            <Text style={styles.pendingBannerText}>
              Un administrador revisará tu perfil. Recibirás una notificación cuando
              estés habilitado para aceptar chambas.
            </Text>
          </View>
        )}

        {/* ── Disponibilidad ── */}
        <View style={styles.section}>
          <SectionTitle label="Disponibilidad" subtitle="Tu estado para recibir chambas" />
          <View style={chambaStyles.panelCard}>
            <AvailabilitySelector
              current={currentAvailability}
              onChange={handleAvailabilityChange}
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
                value={ratingDisplay}
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

        {/* ── Mis especialidades registradas ── */}
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

        {/* ── Bio ── */}
        {workerProfile?.bio && (
          <View style={styles.section}>
            <SectionTitle label="Sobre mí" />
            <View style={chambaStyles.panelCard}>
              <Text style={styles.bioText}>{workerProfile.bio}</Text>
            </View>
          </View>
        )}

        {/* ── Reseñas ── */}
        <View
          style={styles.section}
          onLayout={(e) => { reviewsSectionY.current = e.nativeEvent.layout.y; }}
        >
          <SectionTitle label="Reseñas" subtitle="Clientes y administración" />
          <View style={chambaStyles.panelCard}>
            <ProfileSectionBoundary title="las reseñas">
              <WorkerReviewsPanel
                workerId={profile.id}
                reviewerId={profile.id}
                reviewerRole="client"
                reviewerName={profile.full_name}
                allowReview={false}
              />
            </ProfileSectionBoundary>
          </View>
        </View>

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
            title="Estado de cuenta"
            subtitle={profile.is_approved ? 'Verificado ✓' : 'Pendiente de aprobación'}
            iconColor="#5856D6"
            icon={<Ionicons name="shield-checkmark" size={22} color="#FFF" />}
          />
          <ChambaMenuRow
            title={
              workerProfile?.id_verified ? 'Identidad verificada' : 'Identificación oficial'
            }
            subtitle={
              workerProfile?.id_verified
                ? 'Tu ID fue revisado por el equipo'
                : 'Sube tu INE o pasaporte para verificar'
            }
            iconColor={workerProfile?.id_verified ? '#34C759' : '#FF9500'}
            icon={
              <Ionicons
                name={workerProfile?.id_verified ? 'shield-checkmark' : 'document-text'}
                size={22}
                color="#FFF"
              />
            }
            onPress={
              workerProfile?.id_verified ? undefined : () => navigation.navigate('Onboarding')
            }
          />
          <ChambaMenuRow
            title={
              profile.stripe_account_id ? 'Cuenta bancaria conectada' : 'Conectar cuenta bancaria'
            }
            subtitle={
              profile.stripe_account_id
                ? 'Recibís el 95% de cada chamba vía Stripe'
                : 'Necesario para cobrar — ~2 minutos'
            }
            iconColor={profile.stripe_account_id ? '#34C759' : '#FF9500'}
            icon={<Ionicons name="card" size={22} color="#FFF" />}
          />
          {profile.role === 'worker' && (
            <ChambaMenuRow
              title="Mis documentos y especialidades"
              subtitle={
                profile.cedula_url && !isPilotDocumentBypass(profile.cedula_url)
                  ? 'Documentos enviados — toca para actualizar'
                  : 'Sube tu cédula y récord de policía'
              }
              iconColor="#5856D6"
              icon={<Ionicons name="folder-open" size={22} color="#FFF" />}
              onPress={() => navigation.navigate('Onboarding')}
            />
          )}
          <ChambaMenuRow
            title="Reseñas y ranking"
            subtitle={`${reviewCount} comentarios · ${ratingDisplay} estrellas`}
            iconColor="#FF9500"
            icon={<Ionicons name="star" size={22} color="#FFF" />}
            onPress={scrollToReviews}
          />
          <ChambaMenuRow
            title="Cerrar sesión"
            subtitle="Salir de tu cuenta de forma segura"
            iconColor="#FF453A"
            icon={<Ionicons name="log-out-outline" size={22} color="#FFF" />}
            onPress={handleSignOut}
            destructive
          />
        </View>

        <Text style={styles.versionText}>CHAMBA · Perfil técnico</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles (Stitch / Material 3) ─────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    height:            48,
    backgroundColor:   M3.background,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm + 4,
  },
  topBarAvatar: {
    width:           32,
    height:          32,
    borderRadius:    16,
    overflow:        'hidden',
    backgroundColor: M3.surfaceVariant,
  },
  topBarTitle: {
    fontSize:   20,
    fontWeight: '700',
    color:      M3.primary,
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  section: { gap: 4 },
  bentoGrid: { gap: 10, marginBottom: 4 },
  bentoRow: { flexDirection: 'row', gap: 10 },
  profileCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: SPACING.md + 4,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...CARD_STEP_SHADOW,
  },
  profileGradient: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          96,
    backgroundColor: M3.primaryFixed,
    opacity:         0.5,
  },
  avatarWrap: {
    position: 'relative',
    marginTop: SPACING.sm,
    zIndex:    1,
  },
  avatarImg: {
    borderWidth: 4,
    borderColor: M3.surfaceContainerLowest,
  },
  availRing: {
    position:     'absolute',
    top:          -4,
    left:         -4,
    right:        -4,
    bottom:       -4,
    borderRadius: 58,
    borderWidth:  2.5,
  },
  cameraBtn: {
    position:        'absolute',
    bottom:          2,
    right:           2,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: M3.primary,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     M3.surfaceContainerLowest,
    zIndex:          2,
  },
  profileName: {
    fontSize:     18,
    fontWeight:   '600',
    color:        M3.onBackground,
    marginTop:    SPACING.md,
    marginBottom: SPACING.xs,
    textAlign:    'center',
    zIndex:       1,
  },
  verifiedPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   M3.secondaryContainer,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical:   SPACING.xs,
    borderRadius:      BORDER_RADIUS.full,
    zIndex:            1,
  },
  verifiedPillText: {
    fontSize:   12,
    fontWeight: '700',
    color:      M3.onSecondaryContainer,
  },
  pendingPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   M3.tertiaryFixed,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical:   SPACING.xs,
    borderRadius:      BORDER_RADIUS.full,
    zIndex:            1,
  },
  pendingPillText: {
    fontSize:   12,
    fontWeight: '700',
    color:      M3.onTertiaryFixedVariant,
  },
  ratingBento: {
    flexDirection: 'row',
    gap:           SPACING.sm + 4,
    marginTop:     SPACING.md,
    width:         '100%',
    zIndex:        1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginBottom:  4,
  },
  ratingValue: {
    fontSize:   32,
    fontWeight: '700',
    color:      M3.onBackground,
    letterSpacing: -0.5,
  },
  bentoTile: {
    flex:              1,
    backgroundColor:   M3.surface,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1,
    borderColor:       M3.surfaceVariant,
    padding:           SPACING.md,
    alignItems:        'center',
    justifyContent:    'center',
  },
  bentoValue: {
    fontSize:   FONT_SIZE.lg,
    fontWeight: '700',
    color:      M3.onBackground,
    textAlign:  'center',
  },
  bentoLabel: {
    fontSize:  14,
    color:     M3.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'center',
  },
  pendingBanner: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             SPACING.sm,
    backgroundColor: M3.tertiaryFixed,
    borderRadius:    12,
    padding:         SPACING.md,
    borderWidth:     1,
    borderColor:     M3.tertiaryFixedDim,
  },
  pendingBannerText: {
    flex:       1,
    color:      M3.onTertiaryFixedVariant,
    fontSize:   FONT_SIZE.sm,
    lineHeight: 20,
  },
  disabledHint: {
    color:     M3.outline,
    fontSize:  FONT_SIZE.xs,
    textAlign: 'center',
  },
  serviceRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        SPACING.md,
  },
  serviceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: M3.surfaceVariant,
  },
  serviceRowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm + 4,
    flex:          1,
  },
  serviceIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: M3.surfaceContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  serviceLabel: {
    fontSize:   16,
    fontWeight: '500',
    color:      M3.onBackground,
  },
  serviceStatus: {
    fontSize:   12,
    fontWeight: '700',
    color:      M3.onSurfaceVariant,
    marginTop:  2,
  },
  serviceStatusPaused: {
    color: M3.outline,
  },
  statusPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:                 4,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical:   4,
    borderRadius:      BORDER_RADIUS.full,
  },
  statusPillActive: {
    backgroundColor: M3.secondaryFixed,
  },
  statusPillPaused: {
    backgroundColor: M3.surfaceContainerHigh,
  },
  statusDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize:   11,
    fontWeight: '700',
  },
  statusPillTextActive: {
    color: M3.onSecondaryContainer,
  },
  statusPillTextPaused: {
    color: M3.outline,
  },
  bioText: {
    color:      M3.onSurfaceVariant,
    fontSize:   16,
    lineHeight: 24,
    padding:    SPACING.md,
  },
  versionText: {
    color: CHAMBA.muted,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    marginBottom: SPACING.md,
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
});
