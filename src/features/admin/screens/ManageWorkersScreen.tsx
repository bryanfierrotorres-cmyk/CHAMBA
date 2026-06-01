import React, { useState } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator,
  TouchableOpacity, Alert, Modal, ScrollView, StyleSheet,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@components/Avatar';
import { Badge } from '@components/Badge';
import { EmptyState } from '@components/EmptyState';
import { DocImageViewer } from '@components/DocImageViewer';
import { MaterialSymbol } from '@components/admin/MaterialSymbol';
import { StitchToggle } from '@components/admin/StitchToggle';
import {
  fetchAllWorkers,
  toggleWorkerApproval,
  approveWorkerCategory2,
} from '../services/adminService';
import { formatDate } from '@utils/formatters';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import type { UserProfile } from '@/types';
import { WorkerReviewsPanel } from '@features/reviews/components/WorkerReviewsPanel';
import { useAuthStore } from '@store/authStore';
import {
  M3, SPACING, BORDER_RADIUS, CARD_ELEVATION, stitchTypography,
} from '@constants/stitchStyles';

type FilterMode = 'all' | 'pending' | 'approved';

// ─── Worker detail modal ──────────────────────────────────────────────────────

interface WorkerModalProps {
  worker:   UserProfile;
  onClose:  () => void;
  onApprove:(approve: boolean) => void;
  onApproveCat2: (approve: boolean) => void;
  approving: boolean;
  approvingCat2: boolean;
  adminId:   string;
  adminName: string;
}

const WorkerDetailModal: React.FC<WorkerModalProps> = ({
  worker, onClose, onApprove, onApproveCat2, approving, approvingCat2,
  adminId, adminName,
}) => {
  const { getLabel } = useCatalog();
  const cat1Label = worker.category_1 ? getLabel(worker.category_1) : null;
  const cat2Label = worker.category_2 ? getLabel(worker.category_2) : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={modal.root}>
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <MaterialSymbol name="cancel" size={22} color={M3.onBackground} />
          </TouchableOpacity>
          <Text style={modal.headerTitle}>Expediente del Técnico</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={modal.scroll}>
          <View style={modal.profileCard}>
            <Avatar uri={worker.avatar_url} name={worker.full_name} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={modal.workerName}>{worker.full_name}</Text>
              <Text style={modal.workerMeta}>{worker.phone ?? worker.email}</Text>
              <Text style={modal.workerMeta}>Desde {formatDate(worker.created_at)}</Text>
            </View>
            <Badge
              label={worker.is_approved ? 'Verificado' : (worker.worker_status ?? 'Pendiente')}
              color={worker.is_approved ? M3.secondary : M3.tertiary}
              bgColor={worker.is_approved ? M3.secondaryFixed : M3.tertiaryFixed}
              size="sm"
            />
          </View>

          <View style={modal.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={modal.toggleTitle}>Estado operativo</Text>
              <Text style={modal.toggleSub}>
                {worker.is_approved ? 'Técnico activo en el radar' : 'Técnico suspendido'}
              </Text>
            </View>
            <StitchToggle
              value={worker.is_approved}
              onValueChange={onApprove}
              loading={approving}
            />
          </View>

          <Text style={modal.sectionTitle}>Documentos de Seguridad</Text>
          <View style={modal.docsRow}>
            <View style={{ flex: 1 }}>
              <DocImageViewer url={worker.cedula_url ?? null} label="Cédula" boxStyle={modal.docBox} />
            </View>
            <View style={{ flex: 1 }}>
              <DocImageViewer url={worker.record_policia_url ?? null} label="Récord Policía" boxStyle={modal.docBox} />
            </View>
          </View>

          <Text style={modal.sectionTitle}>Especialidades</Text>

          {cat1Label ? (
            <View style={modal.catRow}>
              <View style={{ flex: 1 }}>
                <Text style={modal.catLabel}>{cat1Label}</Text>
                <Text style={[modal.catStatus, { color: worker.category_1_approved ? M3.secondary : M3.tertiary }]}>
                  {worker.category_1_approved ? 'Aprobada' : 'Pendiente'}
                </Text>
              </View>
              <Badge label="Principal" color={M3.primaryContainer} bgColor={M3.primaryFixed} size="sm" />
            </View>
          ) : (
            <Text style={modal.emptyCat}>Sin especialidad principal</Text>
          )}

          {cat2Label && (
            <View style={modal.catRow}>
              <View style={{ flex: 1 }}>
                <Text style={modal.catLabel}>{cat2Label}</Text>
                <Text style={[modal.catStatus, { color: worker.category_2_approved ? M3.secondary : M3.tertiary }]}>
                  {worker.category_2_approved ? 'Aprobada' : 'Pendiente aprobación'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge label="Secundaria" color={M3.tertiary} bgColor={M3.tertiaryFixed} size="sm" />
                <TouchableOpacity
                  onPress={() => onApproveCat2(!worker.category_2_approved)}
                  disabled={approvingCat2}
                  style={[modal.cat2Btn, worker.category_2_approved && modal.cat2BtnRevoke]}
                >
                  {approvingCat2
                    ? <ActivityIndicator size="small" color={M3.onPrimary} />
                    : <Text style={modal.cat2BtnText}>
                        {worker.category_2_approved ? 'Revocar 2ª cat.' : 'Aprobar 2ª cat.'}
                      </Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={modal.sectionTitle}>Calificaciones y reseñas</Text>
          <View style={modal.reviewsCard}>
            <WorkerReviewsPanel
              workerId={worker.id}
              workerName={worker.full_name}
              reviewerId={adminId}
              reviewerRole="admin"
              reviewerName={adminName}
              allowReview
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const modal = StyleSheet.create({
  root:         { flex: 1, backgroundColor: M3.background },
  header:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.lg, paddingTop: 56,
    backgroundColor: M3.surfaceContainerLowest,
    borderBottomWidth: 1, borderBottomColor: M3.surfaceVariant,
  },
  closeBtn:     {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: M3.surfaceContainer, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle:  { ...stitchTypography.headlineMdMobile, fontWeight: '800' },
  scroll:       { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.md },

  profileCard:  {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: M3.surfaceContainerLowest, borderRadius: 12,
    padding: SPACING.md, ...CARD_ELEVATION,
  },
  workerName:   { ...stitchTypography.bodyLg, fontWeight: '800' },
  workerMeta:   { ...stitchTypography.labelBold, color: M3.outline, marginTop: 2 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: M3.surfaceContainerLowest, borderRadius: 12,
    padding: SPACING.md, ...CARD_ELEVATION,
  },
  toggleTitle: { ...stitchTypography.bodyLg, fontWeight: '600' },
  toggleSub:   { ...stitchTypography.labelBold, color: M3.outline, marginTop: 2 },

  sectionTitle: { ...stitchTypography.headlineMdMobile, marginTop: SPACING.xs },

  docsRow:  { flexDirection: 'row', gap: SPACING.sm },
  docBox:   {
    width: '100%', height: 140, borderRadius: 12,
  },

  catRow:   {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: M3.surfaceContainerLowest, borderRadius: 12,
    padding: SPACING.md, borderWidth: 1, borderColor: M3.outlineVariant,
  },
  catLabel: { ...stitchTypography.bodySm, fontWeight: '700', color: M3.onBackground },
  catStatus:{ ...stitchTypography.labelBold, marginTop: 2 },
  emptyCat: { ...stitchTypography.bodySm, color: M3.outline },

  cat2Btn:       {
    backgroundColor: M3.primary, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 6, marginTop: 4,
  },
  cat2BtnRevoke: { backgroundColor: M3.tertiary },
  cat2BtnText:   { color: M3.onPrimary, fontSize: 11, fontWeight: '700' },

  reviewsCard: {
    backgroundColor: M3.surfaceContainerLowest, borderRadius: 12,
    padding: SPACING.md, ...CARD_ELEVATION,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export const ManageWorkersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const insets        = useSafeAreaInsets();
  const adminProfile  = useAuthStore((s) => s.profile);
  const [filter, setFilter]             = useState<FilterMode>('all');
  const [selected, setSelected]         = useState<UserProfile | null>(null);
  const [approvingId, setApprovingId]   = useState<string | null>(null);
  const [approvingCat2Id, setAC2Id]     = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery<UserProfile[]>({
    queryKey: ['admin', 'workers'],
    queryFn:  fetchAllWorkers,
  });
  const workers: UserProfile[] = data ?? [];

  const { mutate: toggleApproval } = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      toggleWorkerApproval(id, approve),
    onMutate:   ({ id }) => setApprovingId(id),
    onSettled:  () => { setApprovingId(null); queryClient.invalidateQueries({ queryKey: ['admin', 'workers'] }); },
    onSuccess:  (_data, { approve }) => {
      setSelected((prev) => prev ? { ...prev, is_approved: approve, worker_status: approve ? 'active' : 'suspended' } : null);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const { mutate: toggleCat2 } = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approveWorkerCategory2(id, approve),
    onMutate:   ({ id }) => setAC2Id(id),
    onSettled:  () => { setAC2Id(null); queryClient.invalidateQueries({ queryKey: ['admin', 'workers'] }); },
    onError:    (err: Error) => Alert.alert('Error', err.message),
  });

  const filtered = workers.filter((w) => {
    if (filter === 'pending')  return !w.is_approved;
    if (filter === 'approved') return w.is_approved;
    return true;
  });

  const pendingCount  = workers.filter((w) => !w.is_approved).length;
  const approvedCount = workers.filter((w) => w.is_approved).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialSymbol name="engineering" size={22} color={M3.onPrimaryContainer} filled />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Gestión de Técnicos</Text>
          <Text style={styles.title}>Equipo Operativo</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {([
          ['all',      'Todos',      workers.length, M3.onSurfaceVariant],
          ['pending',  'Pendientes', pendingCount,   M3.tertiary],
          ['approved', 'Verificados', approvedCount,  M3.secondary],
        ] as const).map(([mode, label, count, color]) => (
          <TouchableOpacity
            key={mode}
            onPress={() => setFilter(mode)}
            style={[styles.filterChip, filter === mode && styles.filterChipActive]}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterCount, { color }]}>{count}</Text>
            <Text style={[styles.filterLabel, filter === mode && styles.filterLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={M3.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => (
            <WorkerRow
              worker={item}
              onOpen={() => setSelected(item)}
              onToggle={(approve) => toggleApproval({ id: item.id, approve })}
              toggling={approvingId === item.id}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 100 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={M3.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="Sin técnicos"
              subtitle={filter === 'pending' ? 'No hay técnicos pendientes' : 'Aún no hay técnicos registrados'}
            />
          }
        />
      )}

      {selected && adminProfile && (
        <WorkerDetailModal
          worker={selected}
          onClose={() => setSelected(null)}
          onApprove={(approve) => toggleApproval({ id: selected.id, approve })}
          onApproveCat2={(approve) => toggleCat2({ id: selected.id, approve })}
          approving={approvingId === selected.id}
          approvingCat2={approvingCat2Id === selected.id}
          adminId={adminProfile.id}
          adminName={adminProfile.full_name}
        />
      )}
    </View>
  );
};

// ─── Row (Stitch lista con toggle) ────────────────────────────────────────────

const WorkerRow: React.FC<{
  worker:   UserProfile;
  onOpen:   () => void;
  onToggle: (approve: boolean) => void;
  toggling: boolean;
}> = ({ worker, onOpen, onToggle, toggling }) => {
  const { getLabel } = useCatalog();
  const cat1Label = worker.category_1 ? getLabel(worker.category_1) : null;
  const hasDocs   = !!(worker.cedula_url && worker.record_policia_url);

  return (
    <View style={styles.workerCard}>
      <TouchableOpacity onPress={onOpen} activeOpacity={0.85} style={styles.workerMain}>
        <Avatar uri={worker.avatar_url} name={worker.full_name} size={48} />

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.workerName}>{worker.full_name}</Text>
            {worker.is_approved && (
              <MaterialSymbol name="verified" size={16} color={M3.secondary} filled />
            )}
          </View>
          <Text style={styles.workerMeta}>
            {worker.phone ?? worker.email} · {formatDate(worker.created_at)}
          </Text>

          <View style={styles.badgeRow}>
            <Badge
              label={worker.is_approved ? 'Activo' : 'Suspendido'}
              color={worker.is_approved ? M3.secondary : M3.tertiary}
              bgColor={worker.is_approved ? M3.secondaryFixed : M3.tertiaryFixed}
              size="sm"
            />
            {hasDocs
              ? <Badge label="Docs OK" color={M3.secondary} bgColor={M3.secondaryFixed} size="sm" />
              : <Badge label="Sin docs" color={M3.error} bgColor={M3.errorContainer} size="sm" />}
            {cat1Label && (
              <Badge label={cat1Label} color={M3.primaryContainer} bgColor={M3.primaryFixed} size="sm" />
            )}
          </View>
        </View>

        <MaterialSymbol name="chevron_right" size={20} color={M3.outlineVariant} />
      </TouchableOpacity>

      <View style={styles.toggleDivider} />

      <View style={styles.toggleRow}>
        <View style={styles.toggleIconWrap}>
          <MaterialSymbol
            name={worker.is_approved ? 'check_circle' : 'pause_circle'}
            size={20}
            color={worker.is_approved ? M3.secondary : M3.outline}
            filled={worker.is_approved}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>
            {worker.is_approved ? 'Verificado — operando' : 'Suspendido del radar'}
          </Text>
          <Text style={styles.toggleHint}>
            {worker.is_approved
              ? 'El técnico puede aceptar chambas'
              : 'Toggle para reactivar acceso'}
          </Text>
        </View>
        <StitchToggle
          value={worker.is_approved}
          onValueChange={onToggle}
          loading={toggling}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: M3.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm + 4,
    paddingHorizontal: SPACING.md,
    paddingBottom:     SPACING.sm,
  },
  headerIcon: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: M3.primaryContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  eyebrow: {
    ...stitchTypography.labelBold,
    color:         M3.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    ...stitchTypography.headlineLg,
    fontSize: 22,
  },
  filterRow: {
    flexDirection:     'row',
    gap:               SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom:      SPACING.sm,
  },
  filterChip: {
    flex:              1,
    alignItems:        'center',
    padding:           SPACING.sm,
    borderRadius:      10,
    backgroundColor:   M3.surfaceContainerLowest,
    borderWidth:       1,
    borderColor:       M3.outlineVariant,
  },
  filterChipActive: {
    borderColor:     M3.primary,
    backgroundColor: M3.primaryFixed,
  },
  filterCount: {
    fontSize:   20,
    fontWeight: '800',
  },
  filterLabel: {
    ...stitchTypography.labelBold,
    marginTop: 2,
  },
  filterLabelActive: {
    color: M3.onPrimaryFixedVariant,
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    flexGrow:          1,
  },
  workerCard: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius:    12,
    marginBottom:    SPACING.sm + 4,
    overflow:        'hidden',
    ...CARD_ELEVATION,
  },
  workerMain: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.md,
    padding:       SPACING.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  workerName: {
    ...stitchTypography.bodyLg,
    fontWeight: '700',
  },
  workerMeta: {
    ...stitchTypography.labelBold,
    color:     M3.outline,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
    marginTop:     6,
  },
  toggleDivider: {
    height:          1,
    backgroundColor: M3.surfaceVariant,
  },
  toggleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm + 4,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm + 2,
    backgroundColor:   M3.surfaceContainerLow,
  },
  toggleIconWrap: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: M3.surfaceContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  toggleLabel: {
    ...stitchTypography.bodySm,
    fontWeight: '600',
    color:      M3.onBackground,
  },
  toggleHint: {
    ...stitchTypography.labelBold,
    color:     M3.outline,
    marginTop: 1,
  },
});
