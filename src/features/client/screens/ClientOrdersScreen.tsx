import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@store/authStore';
import { fetchClientOrders } from '@features/jobs/services/jobsService';
import { WorkerReviewsPanel } from '@features/reviews/components/WorkerReviewsPanel';
import { Avatar } from '@components/Avatar';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/theme';
import { getCategoryLabel, getCategoryEmoji, formatDate, formatCurrency } from '@utils/formatters';
import type { ClientOrderJob, JobStatus } from '@/types';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  open:        { label: 'Publicada',    color: '#166534', bg: '#DCFCE7', icon: 'radio-button-on' },
  taken:       { label: 'En proceso',   color: '#92400E', bg: '#FEF3C7', icon: 'time'            },
  in_progress: { label: 'En proceso',   color: '#92400E', bg: '#FEF3C7', icon: 'time'            },
  completed:   { label: 'Finalizado',   color: '#4B5563', bg: '#F3F4F6', icon: 'checkmark-circle' },
  cancelled:   { label: 'Cancelada',    color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle'    },
};

const canRateWorker = (job: ClientOrderJob): boolean =>
  !!job.assigned_worker &&
  ['taken', 'in_progress', 'completed'].includes(job.status);

// ─── Job Order Card ───────────────────────────────────────────────────────────

interface OrderCardProps {
  job:          ClientOrderJob;
  clientId:     string;
  clientName:   string;
}

const OrderCard: React.FC<OrderCardProps> = ({ job, clientId, clientName }) => {
  const status = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.open;
  const worker = job.assigned_worker;
  const showReview = canRateWorker(job);

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={styles.categoryBadge}>
          <Text>{getCategoryEmoji(job.category)}</Text>
          <Text style={styles.categoryText}>{getCategoryLabel(job.category)}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={12} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Title & description */}
      <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>
      <Text style={styles.jobDesc}  numberOfLines={2}>{job.description}</Text>

      {/* Assigned worker */}
      {worker && (
        <View style={styles.workerRow}>
          <Avatar uri={worker.avatar_url} name={worker.full_name} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={styles.workerLabel}>Técnico asignado</Text>
            <Text style={styles.workerName}>{worker.full_name}</Text>
          </View>
        </View>
      )}

      {/* Bottom info row */}
      <View style={styles.cardBottom}>
        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={13} color={COLORS.text.muted} />
          <Text style={styles.infoText} numberOfLines={1}>{job.location?.address ?? '—'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.text.muted} />
          <Text style={styles.infoText}>{formatDate(job.created_at)}</Text>
        </View>
      </View>

      {/* Pay */}
      <View style={styles.cardFooter}>
        <Text style={styles.payLabel}>Presupuesto</Text>
        <Text style={styles.payAmount}>{formatCurrency(job.pay_amount)}</Text>
      </View>

      {/* Rate worker */}
      {showReview && worker && (
        <View style={styles.reviewSection}>
          <View style={styles.reviewHeader}>
            <Ionicons name="star" size={16} color="#FBBF24" />
            <Text style={styles.reviewTitle}>Califica a tu técnico</Text>
          </View>
          <WorkerReviewsPanel
            workerId={worker.id}
            workerName={worker.full_name}
            reviewerId={clientId}
            reviewerRole="client"
            reviewerName={clientName}
            allowReview
            compact
          />
        </View>
      )}

      {!worker && job.status !== 'open' && job.status !== 'cancelled' && (
        <View style={styles.pendingWorker}>
          <Ionicons name="person-outline" size={14} color={COLORS.text.muted} />
          <Text style={styles.pendingWorkerText}>Esperando asignación de técnico</Text>
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const ClientOrdersScreen: React.FC = () => {
  const insets  = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['client-orders', profile?.id],
    queryFn:  () => fetchClientOrders(profile!.id),
    enabled:  !!profile?.id,
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mis Solicitudes</Text>
          <Text style={styles.headerSub}>
            {jobs.length} {jobs.length === 1 ? 'solicitud' : 'solicitudes'} enviadas
          </Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.brand[600]} />
        </TouchableOpacity>
      </View>

      {/* ── List ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.brand[500]} />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.brand[500]} />
          }
          renderItem={({ item }) => (
            profile ? (
              <OrderCard
                job={item}
                clientId={profile.id}
                clientName={profile.full_name}
              />
            ) : null
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Text style={{ fontSize: 40 }}>📋</Text>
              </View>
              <Text style={styles.emptyTitle}>Sin solicitudes aún</Text>
              <Text style={styles.emptySub}>
                Ve a la pestaña de servicios y solicita tu primera chamba.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(247,249,251,0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerTitle: { color: COLORS.text.primary, fontSize: FONT_SIZE.xl, fontWeight: '900', letterSpacing: -0.3 },
  headerSub:   { color: COLORS.text.muted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.brand[50], alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.brand[100],
  },

  listContent: { padding: SPACING.lg, paddingBottom: 40, flexGrow: 1 },

  // ── Order card
  card: {
    backgroundColor: '#FFF', borderRadius: 20, padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F3F4F6', borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryText: { color: COLORS.text.secondary, fontSize: FONT_SIZE.xs, fontWeight: '600' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: BORDER_RADIUS.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },

  jobTitle: { color: COLORS.text.primary, fontSize: FONT_SIZE.md, fontWeight: '800', marginBottom: 4 },
  jobDesc:  { color: COLORS.text.secondary, fontSize: FONT_SIZE.sm, lineHeight: 20, marginBottom: SPACING.sm },

  workerRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: SPACING.sm,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: '#E5E7EB',
  },
  workerLabel: { color: COLORS.text.muted, fontSize: FONT_SIZE.xs },
  workerName:  { color: COLORS.text.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' },

  cardBottom: { gap: 5, marginBottom: SPACING.sm },
  infoItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText:   { color: COLORS.text.muted, fontSize: FONT_SIZE.xs, flex: 1 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB',
  },
  payLabel:  { color: COLORS.text.muted, fontSize: FONT_SIZE.xs, fontWeight: '500' },
  payAmount: { color: COLORS.brand[600], fontSize: FONT_SIZE.lg, fontWeight: '900' },

  reviewSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    gap: SPACING.sm,
  },
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  reviewTitle: {
    color: COLORS.text.primary, fontSize: FONT_SIZE.sm, fontWeight: '800',
  },

  pendingWorker: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: SPACING.sm, paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB',
  },
  pendingWorkerText: {
    color: COLORS.text.muted, fontSize: FONT_SIZE.xs,
  },

  // ── Empty & Loading
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.brand[50],
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  emptyTitle: { color: COLORS.text.primary, fontSize: FONT_SIZE.lg, fontWeight: '800', marginBottom: 8 },
  emptySub:   { color: COLORS.text.muted, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 22 },
});
