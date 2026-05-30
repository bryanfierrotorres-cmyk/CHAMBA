import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, Linking, ActivityIndicator, StyleSheet, Platform,
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
import { useJobDetail, useAcceptJob } from '../hooks/useJobs';
import { useAuthStore } from '@store/authStore';
import { WORKER_COLORS as COLORS, M3, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/workerTheme';
import { JobLocationLabel } from '@components/worker/JobLocationLabel';
import {
  formatCurrency, formatDate, formatTime,
  getCategoryEmoji, getCategoryLabel, formatDistance,
} from '@utils/formatters';
import type { JobStackParamList } from '@/types';

type Route = RouteProp<JobStackParamList, 'JobDetail'>;
type Nav   = NativeStackNavigationProp<JobStackParamList, 'JobDetail'>;

// ─── Detail row component ─────────────────────────────────────────────────────

const DetailItem: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = ({
  icon, label, value,
}) => (
  <View style={styles.detailItem}>
    <View style={styles.detailIconWrap}>
      <Ionicons name={icon} size={16} color={COLORS.brand[500]} />
    </View>
    <View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <Text style={styles.sectionLabel}>{label}</Text>
);

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

  if (isLoading || !job) {
    return (
      <View style={[styles.root, styles.loading]}>
        <ActivityIndicator size="large" color={COLORS.brand[500]} />
      </View>
    );
  }

  const canAccept = job.status === 'open' && profile?.role === 'worker' && profile?.is_approved && !accepted;

  const handleAccept = () => {
    if (Platform.OS === 'web') {
      if (confirm(`¿Tomar "${job.title}"?\nRecibirás ${formatCurrency(job.worker_payout)}`)) {
        accept({ jobId: job.id, job })
          .then(() => {
            setAccepted(true);
            alert(`✅ ¡Chamba tomada! Recibirás ${formatCurrency(job.worker_payout)}`);
            navigation.navigate('JobActive', { jobId: job.id });
          })
          .catch((err: any) => alert(`Error: ${err.message ?? 'Este trabajo ya fue tomado'}`));
      }
      return;
    }
    Alert.alert(
      '¿Confirmar Chamba?',
      `Vas a tomar: "${job.title}"\n\nRecibirás: ${formatCurrency(job.worker_payout)}\n\n¿Estás seguro?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '¡Tomar Chamba!',
          style: 'default',
          onPress: async () => {
            try {
              await accept({ jobId: job.id });
              setAccepted(true);
              Alert.alert(
                '✅ ¡Chamba tomada!',
                `El servicio quedó en proceso. Aparece en Mis Chambas.`,
                [
                  {
                    text: 'Ver trabajo',
                    onPress: () => navigation.navigate('JobActive', { jobId: job.id }),
                  },
                  { text: 'OK' },
                ],
              );
            } catch (err: any) {
              Alert.alert('No disponible', err.message ?? 'Este trabajo ya fue tomado');
            }
          },
        },
      ],
    );
  };

  const openMaps = () => {
    const { lat, lng } = job.location;
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {getCategoryLabel(job.category)}
        </Text>
        <View style={styles.backBtn}>
          <StatusBadge status={job.status} size="sm" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <View style={styles.heroRow}>
          <View style={styles.heroIconWrap}>
            <Text style={styles.heroEmoji}>{getCategoryEmoji(job.category)}</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.jobCategory}>{getCategoryLabel(job.category)}</Text>
          </View>
        </View>

        {/* ── Pay breakdown ────────────────────────────────────── */}
        <Card style={styles.section} elevated>
          <SectionLabel label="DESGLOSE DE PAGO" />
          <View style={styles.payRow}>
            <View style={styles.payItem}>
              <Text style={styles.payItemLabel}>Total del trabajo</Text>
              <Text style={styles.payItemValue}>{formatCurrency(job.pay_amount)}</Text>
            </View>
            <View style={styles.payDivider} />
            <View style={styles.payItem}>
              <Text style={styles.payItemLabel}>Comisión (5%)</Text>
              <Text style={[styles.payItemValue, { color: COLORS.error }]}>
                −{formatCurrency(job.platform_fee)}
              </Text>
            </View>
            <View style={styles.payDivider} />
            <View style={styles.payItem}>
              <Text style={[styles.payItemLabel, { color: COLORS.brand[600] }]}>Tu ganancia</Text>
              <Text style={[styles.payItemValue, { color: COLORS.brand[600], fontSize: FONT_SIZE.xl }]}>
                {formatCurrency(job.worker_payout)}
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Detalles ─────────────────────────────────────────── */}
        <Card style={styles.section}>
          <SectionLabel label="DETALLES DEL TRABAJO" />
          <View style={styles.detailsGrid}>
            <DetailItem icon="time-outline"    label="Duración"      value={`${job.duration_hours}h`} />
            <DetailItem icon="people-outline"  label="Trabajadores"  value={`${job.slots_taken}/${job.required_workers}`} />
            {job.scheduled_at && (
              <>
                <DetailItem icon="calendar-outline" label="Fecha" value={formatDate(job.scheduled_at)} />
                <DetailItem icon="alarm-outline"    label="Hora"  value={formatTime(job.scheduled_at)} />
              </>
            )}
          </View>
        </Card>

        {/* ── Descripción ──────────────────────────────────────── */}
        <Card style={styles.section}>
          <SectionLabel label="DESCRIPCIÓN" />
          <Text style={styles.description}>{job.description}</Text>
        </Card>

        {/* ── Creador ──────────────────────────────────────────── */}
        {job.creator && (
          <Card style={styles.section}>
            <SectionLabel label="PUBLICADO POR" />
            <View style={styles.creatorRow}>
              <Avatar uri={job.creator.avatar_url} name={job.creator.full_name ?? '?'} size={48} />
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>{job.creator.full_name}</Text>
                <View style={styles.creatorBadge}>
                  <Ionicons name="briefcase" size={12} color={COLORS.brand[500]} />
                  <Text style={styles.creatorRole}>Empresa verificada</Text>
                </View>
              </View>
              <View style={styles.ratingChip}>
                <Ionicons name="star" size={12} color={COLORS.warning} />
                <Text style={styles.ratingText}>4.8</Text>
              </View>
            </View>
          </Card>
        )}

        {/* ── Mapa ─────────────────────────────────────────────── */}
        <Card noPadding style={styles.mapCard}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude:      job.location.lat,
              longitude:     job.location.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={false}
          >
            <Marker
              coordinate={{ latitude: job.location.lat, longitude: job.location.lng }}
              title={job.title}
              pinColor={COLORS.brand[500]}
            />
          </MapView>
          <TouchableOpacity onPress={openMaps} style={styles.mapFooter}>
            <JobLocationLabel
              address={job.location.address}
              showDistance
              distanceKm={job.location.distance_km}
            />
          </TouchableOpacity>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky action button ─────────────────────────────── */}
      {profile?.role === 'worker' && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + SPACING.md }]}>
          {!profile.is_approved ? (
            <View style={styles.pendingBox}>
              <Ionicons name="time-outline" size={18} color={COLORS.warning} />
              <Text style={styles.pendingText}>Tu cuenta está pendiente de aprobación</Text>
            </View>
          ) : accepted ? (
            <View style={styles.takenBox}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={styles.takenText}>¡Chamba tomada!</Text>
            </View>
          ) : (
            <Button
              label={`Tomar Chamba  •  ${formatCurrency(job.worker_payout)}`}
              onPress={handleAccept}
              isLoading={isPending}
              disabled={!canAccept}
              fullWidth
              size="lg"
            />
          )}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.bg.card,
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
