import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  Alert, ActivityIndicator, StyleSheet, Platform, ViewStyle, StyleProp,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@components/Button';
import { StatusBadge } from '@components/Badge';
import { Avatar } from '@components/Avatar';
import { Card } from '@components/Card';
import { ScreenBackButton } from '@components/navigation/ScreenBackButton';
import { useJobDetail, useAcceptJob } from '../hooks/useJobs';
import { useAuthStore } from '@store/authStore';
import { getLocalAssignments } from '@utils/localAssignments';
import { WORKER_COLORS as COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/workerTheme';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';
import { JobLocationLabel } from '@components/worker/JobLocationLabel';
import { JobRequestPreviewModal } from '@components/jobs/JobRequestPreviewModal';
import { getJobRequestPhotoUrl } from '@utils/jobRequestPhoto';
import { openJobLocationInMaps } from '@utils/openMaps';
import {
  formatCurrency, formatDate, formatTime,
  getCategoryEmoji, getCategoryLabel,
} from '@utils/formatters';
import type { JobStackParamList } from '@/types';

type Route = RouteProp<JobStackParamList, 'JobDetail'>;
type Nav   = NativeStackNavigationProp<JobStackParamList, 'JobDetail'>;

// ─── Shared sub-components ────────────────────────────────────────────────────

const DetailItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  admin?: boolean;
}> = ({ icon, label, value, admin }) => (
  <View style={styles.detailItem}>
    <View style={[styles.detailIconWrap, admin && adminStyles.detailIconWrap]}>
      <Ionicons name={icon} size={16} color={admin ? CHAMBA.blue : COLORS.brand[500]} />
    </View>
    <View>
      <Text style={[styles.detailLabel, admin && adminStyles.detailLabel]}>{label}</Text>
      <Text style={[styles.detailValue, admin && adminStyles.detailValue]}>{value}</Text>
    </View>
  </View>
);

const SectionLabel: React.FC<{ label: string; admin?: boolean }> = ({ label, admin }) => (
  <Text style={[styles.sectionLabel, admin && adminStyles.sectionLabel]}>{label}</Text>
);

const SectionPanel: React.FC<{
  admin?: boolean;
  elevated?: boolean;
  noPadding?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ admin, elevated, noPadding, style, children }) => {
  if (admin) {
    return (
      <View style={[adminStyles.panel, noPadding && adminStyles.panelNoPad, style]}>
        {children}
      </View>
    );
  }
  return (
    <Card style={style as ViewStyle} elevated={elevated} noPadding={noPadding}>
      {children}
    </Card>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export const JobDetailScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const { jobId }  = route.params;

  const profile                          = useAuthStore((s) => s.profile);
  const { data: job, isLoading }         = useJobDetail(jobId);
  const { mutateAsync: accept, isPending } = useAcceptJob();
  const [accepted, setAccepted]          = useState(false);
  const [awaitingClientChoice, setAwaitingClientChoice] = useState(false);
  const [previewOpen, setPreviewOpen]    = useState(false);
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!profile?.id || profile.role !== 'worker' || !job) return;
    void (async () => {
      const mine = job.assigned_worker_id === profile.id;
      if (job.status === 'taken' && mine) {
        setAccepted(true);
        setAwaitingClientChoice(false);
        return;
      }
      const local = (await getLocalAssignments(profile.id)).find((a) => a.job_id === job.id);
      if (job.status === 'open' && local?.job?.status === 'open') {
        setAwaitingClientChoice(true);
      }
    })();
  }, [profile?.id, profile?.role, job?.id, job?.status, job?.assigned_worker_id]);

  if (isLoading || !job) {
    return (
      <View style={[styles.root, isAdmin && adminStyles.root, styles.loading]}>
        <ActivityIndicator size="large" color={isAdmin ? CHAMBA.blue : COLORS.brand[500]} />
      </View>
    );
  }

  const canAccept =
    job.status === 'open' &&
    profile?.role === 'worker' &&
    profile?.is_approved &&
    !accepted &&
    !awaitingClientChoice;
  const requestPhotoUrl = getJobRequestPhotoUrl(job);
  const payoutLabel = isAdmin ? 'Pago al técnico' : 'Tu ganancia';
  const payoutColor = isAdmin ? CHAMBA.blue : COLORS.brand[600];

  const handleAccept = () => {
    const confirmMsg =
      `¿Postularte a "${job.title}"?\n\nEl cliente verá tu perfil y decidirá si te elige.\nGanancia estimada: ${formatCurrency(job.worker_payout)}`;

    if (Platform.OS === 'web') {
      if (!confirm(confirmMsg)) return;
      accept({ jobId: job.id, job })
        .then((result) => {
          if (result.pendingClientSelection) {
            setAwaitingClientChoice(true);
            alert('📨 Postulación enviada. El cliente revisará tu perfil.');
            return;
          }
          setAccepted(true);
          alert(`✅ ¡Chamba asignada! Recibirás ${formatCurrency(job.worker_payout)}`);
          navigation.navigate('JobActive', { jobId: job.id });
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'No se pudo postular';
          alert(`Error: ${msg}`);
        });
      return;
    }

    Alert.alert('¿Postularte?', confirmMsg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Enviar postulación',
        style: 'default',
        onPress: async () => {
          try {
            const result = await accept({ jobId: job.id, job });
            if (result.pendingClientSelection) {
              setAwaitingClientChoice(true);
              Alert.alert(
                '📨 Postulación enviada',
                'El cliente revisará tu perfil y te avisará si te elige.',
              );
              return;
            }
            setAccepted(true);
            Alert.alert(
              '✅ ¡Chamba asignada!',
              'El servicio quedó en proceso. Aparece en Mis Chambas.',
              [
                {
                  text: 'Ver trabajo',
                  onPress: () => navigation.navigate('JobActive', { jobId: job.id }),
                },
                { text: 'OK' },
              ],
            );
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'No se pudo postular';
            Alert.alert('No disponible', msg);
          }
        },
      },
    ]);
  };

  const location = job.location;
  const hasMapCoords = !!(location && (location.lat !== 0 || location.lng !== 0));
  const hasMapAddress = !!location?.address?.trim();
  const showLocationSection = !!(location && (hasMapCoords || hasMapAddress));

  const handleOpenMaps = () => {
    if (!location) return;
    void openJobLocationInMaps({
      lat: location.lat,
      lng: location.lng,
      address: location.address,
    });
  };

  return (
    <View style={[styles.root, isAdmin && adminStyles.root, { paddingTop: insets.top }]}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={[styles.header, isAdmin && adminStyles.header]}>
        <ScreenBackButton onPress={() => navigation.goBack()} color={isAdmin ? CHAMBA.navy : COLORS.text.primary} />
        <Text style={[styles.headerTitle, isAdmin && adminStyles.headerTitle]} numberOfLines={1}>
          {isAdmin ? 'Detalle de chamba' : getCategoryLabel(job.category)}
        </Text>
        <View style={[styles.backBtn, isAdmin && adminStyles.badgeWrap]}>
          <StatusBadge status={job.status} size="sm" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, isAdmin && adminStyles.scroll]}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <View style={[styles.heroRow, isAdmin && adminStyles.heroRow]}>
          <View style={[styles.heroIconWrap, isAdmin && adminStyles.heroIconWrap]}>
            <Text style={styles.heroEmoji}>{getCategoryEmoji(job.category)}</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.jobTitle, isAdmin && adminStyles.jobTitle]}>{job.title}</Text>
            <Text style={[styles.jobCategory, isAdmin && adminStyles.jobCategory]}>
              {getCategoryLabel(job.category)}
            </Text>
          </View>
        </View>

        {/* ── Pay breakdown ────────────────────────────────────── */}
        <SectionPanel admin={isAdmin} style={styles.section} elevated>
          <SectionLabel label={isAdmin ? 'Desglose de pago' : 'DESGLOSE DE PAGO'} admin={isAdmin} />
          <View style={styles.payRow}>
            <View style={styles.payItem}>
              <Text style={[styles.payItemLabel, isAdmin && adminStyles.payItemLabel]}>Total del trabajo</Text>
              <Text style={[styles.payItemValue, isAdmin && adminStyles.payItemValue]}>
                {formatCurrency(job.pay_amount)}
              </Text>
            </View>
            <View style={[styles.payDivider, isAdmin && adminStyles.payDivider]} />
            <View style={styles.payItem}>
              <Text style={[styles.payItemLabel, isAdmin && adminStyles.payItemLabel]}>Comisión (5%)</Text>
              <Text style={[styles.payItemValue, { color: COLORS.error }]}>
                −{formatCurrency(job.platform_fee)}
              </Text>
            </View>
            <View style={[styles.payDivider, isAdmin && adminStyles.payDivider]} />
            <View style={styles.payItem}>
              <Text style={[styles.payItemLabel, { color: payoutColor }, isAdmin && adminStyles.payItemLabel]}>
                {payoutLabel}
              </Text>
              <Text style={[styles.payItemValue, { color: payoutColor, fontSize: FONT_SIZE.xl }, isAdmin && adminStyles.payItemValueHighlight]}>
                {formatCurrency(job.worker_payout)}
              </Text>
            </View>
          </View>
        </SectionPanel>

        {/* ── Detalles ─────────────────────────────────────────── */}
        <SectionPanel admin={isAdmin} style={styles.section}>
          <SectionLabel label={isAdmin ? 'Detalles del trabajo' : 'DETALLES DEL TRABAJO'} admin={isAdmin} />
          <View style={styles.detailsGrid}>
            <DetailItem admin={isAdmin} icon="time-outline"    label="Duración"     value={`${job.duration_hours}h`} />
            <DetailItem admin={isAdmin} icon="people-outline"  label="Trabajadores" value={`${job.slots_taken}/${job.required_workers}`} />
            {job.scheduled_at && (
              <>
                <DetailItem admin={isAdmin} icon="calendar-outline" label="Fecha" value={formatDate(job.scheduled_at)} />
                <DetailItem admin={isAdmin} icon="alarm-outline"    label="Hora"  value={formatTime(job.scheduled_at)} />
              </>
            )}
          </View>
        </SectionPanel>

        {/* ── Foto + descripción del cliente ───────────────────── */}
        {requestPhotoUrl && profile?.role === 'worker' && (
          <SectionPanel admin={isAdmin} style={styles.section}>
            <SectionLabel label="REFERENCIA DEL CLIENTE" admin={isAdmin} />
            <Image
              source={{ uri: requestPhotoUrl }}
              style={styles.requestPhotoThumb}
              resizeMode="cover"
            />
            <Text style={[styles.description, isAdmin && adminStyles.description]}>
              {job.description}
            </Text>
            <TouchableOpacity
              style={styles.visualizeBtn}
              onPress={() => setPreviewOpen(true)}
              activeOpacity={0.88}
            >
              <Ionicons name="eye-outline" size={20} color="#FFF" />
              <Text style={styles.visualizeBtnText}>Visualizar servicio</Text>
            </TouchableOpacity>
          </SectionPanel>
        )}

        {/* ── Descripción ──────────────────────────────────────── */}
        {!(profile?.role === 'worker' && requestPhotoUrl) && (
          <SectionPanel admin={isAdmin} style={styles.section}>
            <SectionLabel label={isAdmin ? 'Descripción' : 'DESCRIPCIÓN'} admin={isAdmin} />
            <Text style={[styles.description, isAdmin && adminStyles.description]}>{job.description}</Text>
          </SectionPanel>
        )}

        {/* ── Creador ──────────────────────────────────────────── */}
        {job.creator && (
          <SectionPanel admin={isAdmin} style={styles.section}>
            <SectionLabel label={isAdmin ? 'Publicado por' : 'PUBLICADO POR'} admin={isAdmin} />
            <View style={styles.creatorRow}>
              <Avatar uri={job.creator.avatar_url} name={job.creator.full_name ?? '?'} size={48} />
              <View style={styles.creatorInfo}>
                <Text style={[styles.creatorName, isAdmin && adminStyles.creatorName]}>{job.creator.full_name}</Text>
                <View style={styles.creatorBadge}>
                  <Ionicons name="briefcase" size={12} color={isAdmin ? CHAMBA.blue : COLORS.brand[500]} />
                  <Text style={[styles.creatorRole, isAdmin && adminStyles.creatorRole]}>Empresa verificada</Text>
                </View>
              </View>
              <View style={[styles.ratingChip, isAdmin && adminStyles.ratingChip]}>
                <Ionicons name="star" size={12} color={COLORS.warning} />
                <Text style={styles.ratingText}>4.8</Text>
              </View>
            </View>
          </SectionPanel>
        )}

        {/* ── Mapa ─────────────────────────────────────────────── */}
        {showLocationSection && (
        <SectionPanel admin={isAdmin} noPadding style={[styles.mapCard, isAdmin && adminStyles.mapCard]}>
          {hasMapCoords && (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude:      location!.lat,
                longitude:     location!.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
            >
              <Marker
                coordinate={{ latitude: location!.lat, longitude: location!.lng }}
                title={job.title}
                pinColor={isAdmin ? CHAMBA.blue : COLORS.brand[500]}
              />
            </MapView>
          )}
          <View style={[styles.mapFooter, isAdmin && adminStyles.mapFooter]}>
            <JobLocationLabel
              address={location?.address}
              showDistance
              distanceKm={location?.distance_km}
            />
            {profile?.role === 'worker' && (hasMapCoords || hasMapAddress) && (
              <TouchableOpacity
                onPress={handleOpenMaps}
                style={[styles.openMapBtn, isAdmin && adminStyles.openMapBtn]}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Abrir en Mapa"
              >
                <Ionicons name="navigate-outline" size={18} color={isAdmin ? CHAMBA.blue : COLORS.brand[600]} />
                <Text style={[styles.openMapBtnText, isAdmin && adminStyles.openMapBtnText]}>
                  Abrir en Mapa
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </SectionPanel>
        )}

        <View style={{ height: isAdmin ? 40 + insets.bottom : 100 }} />
      </ScrollView>

      {/* ── Sticky action button ─────────────────────────────── */}
      {profile?.role === 'worker' && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + SPACING.md }]}>
          {!profile.is_approved ? (
            <View style={styles.pendingBox}>
              <Ionicons name="time-outline" size={18} color={COLORS.warning} />
              <Text style={styles.pendingText}>Tu cuenta está pendiente de aprobación</Text>
            </View>
          ) : awaitingClientChoice ? (
            <View style={styles.pendingBox}>
              <Ionicons name="hourglass-outline" size={18} color={COLORS.brand[500]} />
              <Text style={styles.pendingText}>
                Postulaste — el cliente revisará tu perfil y te elegirá
              </Text>
            </View>
          ) : accepted ? (
            <View style={styles.takenBox}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={styles.takenText}>¡Chamba asignada!</Text>
            </View>
          ) : (
            <Button
              label={`Postularme  •  ${formatCurrency(job.worker_payout)}`}
              onPress={handleAccept}
              isLoading={isPending}
              disabled={!canAccept}
              fullWidth
              size="lg"
            />
          )}
        </View>
      )}

      {requestPhotoUrl && (
        <JobRequestPreviewModal
          visible={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title={job.title}
          description={job.description}
          category={job.category}
          photoUrl={requestPhotoUrl}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg.primary,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.subtle,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  // Hero
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.bg.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.brand[100],
    flexShrink: 0,
  },
  heroEmoji: {
    fontSize: 32,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  jobTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE['2xl'],
    fontWeight: '800',
    lineHeight: 30,
  },
  jobCategory: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.sm,
  },
  // Section
  section: {
    gap: 0,
  },
  sectionLabel: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: SPACING.md,
  },
  // Pay row
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  payItemLabel: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
  },
  payItemValue: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  payDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border.subtle,
  },
  // Details grid
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minWidth: '45%',
  },
  detailIconWrap: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
  },
  detailValue: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginTop: 1,
  },
  // Description
  description: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.md,
    lineHeight: 24,
  },
  requestPhotoThumb: {
    width: '100%',
    height: 160,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.bg.elevated,
    marginBottom: SPACING.sm,
  },
  visualizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    backgroundColor: COLORS.brand[500],
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: 14,
  },
  visualizeBtnText: {
    color: '#FFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  // Creator
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  creatorInfo: {
    flex: 1,
    gap: 4,
  },
  creatorName: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorRole: {
    color: COLORS.brand[600],
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFBEB',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  ratingText: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  // Map
  mapCard: {
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  map: {
    width: '100%',
    height: 180,
  },
  mapFooter: {
    padding: SPACING.md,
    backgroundColor: COLORS.bg.card,
    gap: SPACING.sm,
  },
  openMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    alignSelf: 'stretch',
    marginTop: SPACING.xs,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.brand[50],
    borderWidth: 1,
    borderColor: COLORS.brand[200],
  },
  openMapBtnText: {
    color: COLORS.brand[600],
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  mapAddress: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.sm,
    flex: 1,
  },
  distanceChip: {
    backgroundColor: COLORS.brand[50],
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  distanceText: {
    color: COLORS.brand[600],
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  // Action bar
  actionBar: {
    backgroundColor: COLORS.bg.card,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.subtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFFBEB',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingText: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.sm,
    flex: 1,
    fontWeight: '500',
  },
  takenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F0FDF4',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  takenText: {
    color: COLORS.success,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});

const adminStyles = StyleSheet.create({
  root: { backgroundColor: CHAMBA.bg },
  header: {
    backgroundColor: CHAMBA.bg,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: CHAMBA.navy,
    letterSpacing: -0.3,
  },
  badgeWrap: {
    backgroundColor: 'transparent',
    width: 'auto',
    minWidth: 36,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
  },
  heroRow: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    ...CARD_STEP_SHADOW,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    borderWidth: 0,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: CHAMBA.navy,
    lineHeight: 24,
  },
  jobCategory: {
    fontSize: 13,
    color: CHAMBA.muted,
    fontWeight: '400',
  },
  panel: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    ...CARD_STEP_SHADOW,
  },
  panelNoPad: { padding: 0, overflow: 'hidden' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: CHAMBA.muted,
    letterSpacing: 0,
    marginBottom: 12,
  },
  payItemLabel: {
    color: CHAMBA.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  payItemValue: {
    color: CHAMBA.navy,
    fontSize: 16,
    fontWeight: '600',
  },
  payItemValueHighlight: {
    color: CHAMBA.blue,
    fontSize: 18,
    fontWeight: '700',
  },
  payDivider: { backgroundColor: CHAMBA.border },
  detailIconWrap: { backgroundColor: '#E0F2FE', borderRadius: 10 },
  detailLabel: { color: CHAMBA.muted, fontWeight: '500' },
  detailValue: { color: CHAMBA.navy, fontWeight: '600' },
  description: { color: CHAMBA.muted, fontSize: 14, fontWeight: '400' },
  creatorName: { color: CHAMBA.navy, fontWeight: '600' },
  creatorRole: { color: CHAMBA.blue, fontWeight: '500' },
  ratingChip: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  mapCard: {
    borderRadius: 18,
    ...CARD_STEP_SHADOW,
  },
  mapFooter: {
    backgroundColor: CHAMBA.white,
    padding: 18,
  },
  openMapBtn: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  openMapBtnText: {
    color: CHAMBA.blue,
  },
});
