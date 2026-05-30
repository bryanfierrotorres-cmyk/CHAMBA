import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
  StyleSheet, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerTopBar } from '@components/worker/WorkerTopBar';
import { Avatar } from '@components/Avatar';
import {
  AvailabilitySelector,
  AvailabilityBadge,
  AVAILABILITY_CONFIG,
} from '@components/AvailabilitySelector';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore }          from '@store/authStore';
import { useProfileStore }       from '@store/profileStore';
import type { ProfileStackParamList, JobCategory } from '@/types';
import { uploadAvatar, updateProfile } from '@features/auth/services/authService';
import { subscribeToWorkerProfile }    from '../services/profileService';
import { WorkerReviewsPanel }          from '@features/reviews/components/WorkerReviewsPanel';
import { useMyJobs }                   from '@features/jobs/hooks/useJobs';
import { M3, FONT_SIZE, SPACING, BORDER_RADIUS, CARD_ELEVATION } from '@constants/stitchStyles';
import { formatCurrency, getCategoryLabel } from '@utils/formatters';
import type { AvailabilityStatus } from '@/types';

const CATEGORY_ICONS: Partial<Record<JobCategory, keyof typeof Ionicons.glyphMap>> = {
  limpieza_sofas:         'water-outline',
  limpieza_alfombra:      'water-outline',
  alfombra_institucional: 'business-outline',
  fumigacion:             'bug-outline',
  vehiculo_profundo:      'car-outline',
  conserjeria_ocasional:  'time-outline',
  conserjeria_contrato:   'document-text-outline',
  jardineria:             'leaf-outline',
};

// ─── Section header (Stitch headline-md) ──────────────────────────

const SectionTitle: React.FC<{ label: string }> = ({ label }) => (
  <Text style={styles.sectionTitle}>{label}</Text>
);

// ─── Menu row (Stitch secondary menu) ─────────────────────────────

const MenuRow: React.FC<{
  icon:      keyof typeof Ionicons.glyphMap;
  title:     string;
  subtitle?: string;
  onPress?:  () => void;
  last?:     boolean;
  trailing?: React.ReactNode;
}> = ({ icon, title, subtitle, onPress, last, trailing }) => {
  const content = (
    <>
      <View style={styles.menuRowLeft}>
        <Ionicons name={icon} size={22} color={M3.onSurfaceVariant} />
        <View style={{ flex: 1 }}>
          <Text style={styles.menuRowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.menuRowSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {trailing ?? (
        onPress
          ? <Ionicons name="chevron-forward" size={20} color={M3.outlineVariant} />
          : null
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={[styles.menuRow, !last && styles.menuRowBorder]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.menuRow, !last && styles.menuRowBorder]}>
      {content}
    </View>
  );
};

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

// ─── Bento stat tile ──────────────────────────────────────────────

const BentoStat: React.FC<{
  icon:    keyof typeof Ionicons.glyphMap;
  value:   string;
  label:   string;
  color?:  string;
  onPress?: () => void;
}> = ({ icon, value, label, color = M3.primary, onPress }) => {
  const inner = (
    <>
      <Ionicons name={icon} size={28} color={color} style={{ marginBottom: 4 }} />
      <Text style={[styles.bentoValue, { color }]}>{value}</Text>
      <Text style={styles.bentoLabel}>{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.bentoTile} onPress={onPress} activeOpacity={0.8}>
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={styles.bentoTile}>{inner}</View>;
};

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

  const loadAll = async () => {
    if (!profile?.id) return;
    await Promise.all([
      loadProfile(profile.id),
      loadStats(profile.id),
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

      await AsyncStorage.setItem('CHAMBA_PILOT_PROFILE', JSON.stringify(updatedProfile));

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

  const currentAvailability = workerProfile?.availability_status ?? 'offline';
  const availCfg = AVAILABILITY_CONFIG[currentAvailability];
  const ratingDisplay = workerProfile?.rating_avg
    ? workerProfile.rating_avg.toFixed(1)
    : '—';
  const reviewCount = workerProfile?.total_reviews ?? 0;

  const acceptedCount = myJobs.length > 0 ? myJobs.length : (stats?.acceptedJobs ?? 0);
  const earnedFromJobs = myJobs
    .filter((a) => a.completed_at || a.job?.status === 'completed')
    .reduce((sum, a) => sum + (a.job?.worker_payout ?? 0), 0);
  const earnedTotal = Math.max(stats?.totalEarned ?? 0, earnedFromJobs);
  const completedCount = myJobs.filter(
    (a) => a.completed_at || a.job?.status === 'completed',
  ).length || (stats?.completedJobs ?? 0);

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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <WorkerTopBar
        avatarUri={avatarPreview ?? profile.avatar_url}
        avatarName={profile.full_name}
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
        {/* ── Profile card (Stitch) ── */}
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
          <SectionTitle label="Disponibilidad" />
          <View style={styles.ambientCard}>
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

        {/* ── Stats bento ── */}
        <View style={styles.section}>
          <SectionTitle label="Resumen" />
          <View style={styles.statsBento}>
            <BentoStat
              icon="briefcase-outline"
              value={String(acceptedCount)}
              label="Aceptadas"
              color={M3.primary}
            />
            <BentoStat
              icon="wallet-outline"
              value={formatCurrency(earnedTotal)}
              label="Ganado"
              color={M3.secondary}
            />
            <BentoStat
              icon="trophy-outline"
              value={ratingDisplay}
              label="Ranking"
              color={M3.tertiaryContainer}
              onPress={scrollToReviews}
            />
            <BentoStat
              icon="checkmark-done-outline"
              value={String(completedCount)}
              label="Completadas"
              color={M3.onSecondaryFixedVariant}
            />
          </View>
        </View>

        {/* ── Mis Servicios / Especialidades ── */}
        {(specialties.length > 0 || (workerProfile?.skills?.length ?? 0) > 0) && (
          <View style={styles.section}>
            <SectionTitle label="Mis Servicios" />
            <View style={styles.ambientCard}>
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
            <View style={styles.ambientCard}>
              <Text style={styles.bioText}>{workerProfile.bio}</Text>
            </View>
          </View>
        )}

        {/* ── Reseñas ── */}
        <View
          style={styles.section}
          onLayout={(e) => { reviewsSectionY.current = e.nativeEvent.layout.y; }}
        >
          <SectionTitle label="Reseñas de clientes y admin" />
          <View style={styles.ambientCard}>
            <WorkerReviewsPanel
              workerId={profile.id}
              reviewerId={profile.id}
              reviewerRole="client"
              reviewerName={profile.full_name}
              allowReview={false}
            />
          </View>
        </View>

        {/* ── Datos de contacto (Stitch menu card) ── */}
        <View style={styles.section}>
          <View style={styles.ambientCard}>
            <MenuRow
              icon="mail-outline"
              title="Correo electrónico"
              subtitle={profile.email}
            />
            <MenuRow
              icon="call-outline"
              title="Teléfono"
              subtitle={profile.phone ?? 'No registrado'}
            />
            <MenuRow
              icon="shield-checkmark-outline"
              title="Estado de cuenta"
              subtitle={profile.is_approved ? 'Verificado ✓' : 'Pendiente de aprobación'}
              last
            />
          </View>
        </View>

        {/* ── Verificación de identidad ── */}
        <View style={styles.section}>
          <View style={styles.ambientCard}>
            <View style={styles.docRow}>
              <View
                style={[
                  styles.docIconWrap,
                  { backgroundColor: workerProfile?.id_verified ? M3.secondaryFixed : M3.surfaceContainer },
                ]}
              >
                <Ionicons
                  name={workerProfile?.id_verified ? 'shield-checkmark' : 'document-outline'}
                  size={22}
                  color={workerProfile?.id_verified ? M3.secondary : M3.onSurfaceVariant}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>
                  {workerProfile?.id_verified
                    ? 'Identidad verificada'
                    : 'Identificación oficial'}
                </Text>
                <Text style={styles.docSub}>
                  {workerProfile?.id_verified
                    ? 'Tu ID fue revisado y aprobado por el equipo'
                    : 'Sube tu INE o pasaporte para verificar tu identidad'}
                </Text>
              </View>
              {!workerProfile?.id_verified && (
                <TouchableOpacity
                  style={styles.docUploadBtn}
                  onPress={() => navigation.navigate('Onboarding')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color={M3.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── Método de cobro ── */}
        <View style={styles.section}>
          <View style={styles.ambientCard}>
            <View style={styles.stripeRow}>
              <View style={styles.stripeIconWrap}>
                <Ionicons name="card-outline" size={22} color={M3.primaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stripeTitle}>
                  {profile.stripe_account_id
                    ? 'Cuenta bancaria conectada'
                    : 'Conectar cuenta bancaria'}
                </Text>
                <Text style={styles.stripeSub}>
                  {profile.stripe_account_id
                    ? 'Recibes el 95% de cada chamba vía Stripe Connect'
                    : 'Necesario para recibir pagos — tarda 2 minutos'}
                </Text>
              </View>
              <View
                style={[
                  styles.stripeStatus,
                  { backgroundColor: profile.stripe_account_id ? M3.secondaryFixed : M3.tertiaryFixed },
                ]}
              >
                <Ionicons
                  name={profile.stripe_account_id ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={profile.stripe_account_id ? M3.secondary : M3.tertiary}
                />
              </View>
            </View>
          </View>
        </View>

        {/* ── Secondary menu (Stitch) ── */}
        {profile.role === 'worker' && (
          <View style={styles.section}>
            <View style={styles.ambientCard}>
              <MenuRow
                icon="document-text-outline"
                title="Mis Documentos y Especialidades"
                subtitle={
                  profile.cedula_url && profile.cedula_url !== 'pilot-bypass'
                    ? 'Documentos enviados — toca para actualizar'
                    : 'Sube tu cédula y récord de policía'
                }
                onPress={() => navigation.navigate('Onboarding')}
              />
            </View>
          </View>
        )}

        {/* ── Cerrar sesión (Stitch text button) ── */}
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutWrap} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>CHAMBA v1.0.0 · MVP</Text>
      </ScrollView>
    </View>
  );
};

// ─── Styles (Stitch / Material 3) ─────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: M3.background,
  },
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
    paddingHorizontal: SPACING.md,
    paddingTop:        SPACING.sm,
    gap:               SPACING.md + 4,
  },
  section: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize:   18,
    fontWeight: '600',
    color:      M3.onBackground,
    paddingHorizontal: 4,
  },
  ambientCard: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius:    12,
    overflow:        'hidden',
    ...CARD_ELEVATION,
  },
  profileCard: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius:    12,
    padding:         SPACING.md + 4,
    alignItems:      'center',
    overflow:        'hidden',
    position:        'relative',
    ...CARD_ELEVATION,
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
  statsBento: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.sm + 4,
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
  menuRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        SPACING.md,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: M3.surfaceVariant,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm + 4,
    flex:          1,
  },
  menuRowTitle: {
    fontSize:   16,
    color:      M3.onBackground,
    fontWeight: '400',
  },
  menuRowSub: {
    fontSize:  14,
    color:     M3.onSurfaceVariant,
    marginTop: 2,
  },
  bioText: {
    color:      M3.onSurfaceVariant,
    fontSize:   16,
    lineHeight: 24,
    padding:    SPACING.md,
  },
  docRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.md,
    padding:       SPACING.md,
  },
  docIconWrap: {
    width:           48,
    height:          48,
    borderRadius:    14,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  docTitle: {
    color:      M3.onBackground,
    fontSize:   16,
    fontWeight: '600',
  },
  docSub: {
    color:      M3.onSurfaceVariant,
    fontSize:   12,
    marginTop:  2,
    lineHeight: 17,
  },
  docUploadBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: M3.primaryFixed,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  stripeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.md,
    padding:       SPACING.md,
  },
  stripeIconWrap: {
    width:           48,
    height:          48,
    borderRadius:    14,
    backgroundColor: M3.surfaceContainerLow,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  stripeTitle: {
    color:      M3.onBackground,
    fontSize:   16,
    fontWeight: '600',
  },
  stripeSub: {
    color:      M3.onSurfaceVariant,
    fontSize:   12,
    marginTop:  2,
    lineHeight: 17,
  },
  stripeStatus: {
    width:           32,
    height:          32,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  signOutWrap: {
    paddingVertical: SPACING.md,
    alignItems:      'center',
  },
  signOutText: {
    color:      M3.error,
    fontSize:   16,
    fontWeight: '400',
  },
  versionText: {
    color:      M3.outline,
    fontSize:   FONT_SIZE.xs,
    textAlign:  'center',
    marginBottom: SPACING.md,
  },
});
