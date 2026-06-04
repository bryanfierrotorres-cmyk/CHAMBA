import React, { useState } from 'react';
import {
  View, Text, FlatList, RefreshControl, ActivityIndicator,
  TouchableOpacity, Alert, Modal, ScrollView, StyleSheet,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { Badge } from '@components/Badge';
import { DocImageViewer } from '@components/DocImageViewer';
import { StitchToggle } from '@components/admin/StitchToggle';
import {
  fetchAllWorkers,
  fetchAllClients,
  toggleWorkerApproval,
  toggleClientApproval,
  approveWorkerCategory2,
} from '../services/adminService';
import { formatNicaPhoneDisplay, NICA_PHONE_PREFIX } from '@utils/phoneNicaragua';
import { formatDate } from '@utils/formatters';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import type { UserProfile } from '@/types';
import { WorkerReviewsPanel } from '@features/reviews/components/WorkerReviewsPanel';
import { useAuthStore } from '@store/authStore';
import { ChambaGradientTabs } from '@components/chamba/ChambaGradientTabs';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import { getWorkerCategoryFamily } from '@utils/workerCategoryAccess';
import { getConfiguredServiceLabel } from '@constants/servicesConfig';

type FilterMode = 'all' | 'pending' | 'approved';
type TeamMode = 'workers' | 'clients';

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
  const insets = useSafeAreaInsets();
  const { getLabel } = useCatalog();
  const cat1Label = worker.category_1 ? getLabel(worker.category_1) : null;
  const cat2Label = worker.category_2 ? getLabel(worker.category_2) : null;

  const includedSubs = (slug: string | null, approved: boolean) => {
    if (!slug || !approved) return null;
    const family = getWorkerCategoryFamily(slug).filter((s) => s !== slug);
    if (family.length === 0) return null;
    return family
      .map((s) => getConfiguredServiceLabel(s) ?? getLabel(s))
      .join(' · ');
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={modal.root} edges={['top']}>
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn} activeOpacity={0.85}>
            <Ionicons name="close" size={22} color={CHAMBA.navy} />
          </TouchableOpacity>
          <Text style={modal.headerTitle}>Expediente del Técnico</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[modal.scroll, { paddingBottom: insets.bottom + 40 }]}
        >
          <View style={modal.profileCard}>
            <Avatar uri={worker.avatar_url} name={worker.full_name} size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={modal.workerName}>{worker.full_name}</Text>
              <Text style={modal.workerMeta}>{worker.phone ?? worker.email}</Text>
              <Text style={modal.workerMeta}>Desde {formatDate(worker.created_at)}</Text>
            </View>
            <Badge
              label={worker.is_approved ? 'Verificado' : (worker.worker_status ?? 'Pendiente')}
              color={worker.is_approved ? '#15803D' : '#B45309'}
              bgColor={worker.is_approved ? '#DCFCE7' : '#FEF3C7'}
              size="sm"
            />
          </View>

          <View style={modal.toggleRow}>
            <View style={modal.toggleIconWrap}>
              <Ionicons
                name={worker.is_approved ? 'checkmark-circle' : 'pause-circle'}
                size={20}
                color={worker.is_approved ? '#34C759' : CHAMBA.muted}
              />
            </View>
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
                <Text style={[modal.catStatus, { color: worker.category_1_approved ? '#15803D' : '#B45309' }]}>
                  {worker.category_1_approved ? 'Aprobada' : 'Pendiente'}
                </Text>
                {includedSubs(worker.category_1, worker.category_1_approved) ? (
                  <Text style={modal.catIncluded}>
                    Incluye: {includedSubs(worker.category_1, worker.category_1_approved)}
                  </Text>
                ) : null}
              </View>
              <Badge label="Principal" color={CHAMBA.blue} bgColor="#E0F2FE" size="sm" />
            </View>
          ) : (
            <Text style={modal.emptyCat}>Sin especialidad principal</Text>
          )}

          {cat2Label && (
            <View style={modal.catRow}>
              <View style={{ flex: 1 }}>
                <Text style={modal.catLabel}>{cat2Label}</Text>
                <Text style={[modal.catStatus, { color: worker.category_2_approved ? '#15803D' : '#B45309' }]}>
                  {worker.category_2_approved ? 'Aprobada' : 'Pendiente aprobación'}
                </Text>
                {includedSubs(worker.category_2, worker.category_2_approved) ? (
                  <Text style={modal.catIncluded}>
                    Incluye: {includedSubs(worker.category_2, worker.category_2_approved)}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge label="Secundaria" color="#7C3AED" bgColor="#EDE9FE" size="sm" />
                <TouchableOpacity
                  onPress={() => onApproveCat2(!worker.category_2_approved)}
                  disabled={approvingCat2}
                  activeOpacity={0.85}
                  style={[modal.cat2Btn, worker.category_2_approved && modal.cat2BtnRevoke]}
                >
                  {approvingCat2
                    ? <ActivityIndicator size="small" color="#FFF" />
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
      </SafeAreaView>
    </Modal>
  );
};

const modal = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: CHAMBA.bg,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: CHAMBA.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_STEP_SHADOW,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: CHAMBA.navy, letterSpacing: -0.3 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    ...CARD_STEP_SHADOW,
  },
  workerName: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy },
  workerMeta: { fontSize: 12, color: CHAMBA.muted, marginTop: 2, fontWeight: '400' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    ...CARD_STEP_SHADOW,
  },
  toggleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#EFF2F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: CHAMBA.navy },
  toggleSub: { fontSize: 12, color: CHAMBA.muted, marginTop: 2, fontWeight: '400' },

  sectionTitle: { fontSize: 18, fontWeight: '600', color: CHAMBA.navy, marginTop: 4, letterSpacing: -0.3 },

  docsRow: { flexDirection: 'row', gap: 12 },
  docBox: { width: '100%', height: 140, borderRadius: 14 },

  catRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: CHAMBA.border,
    ...CARD_STEP_SHADOW,
  },
  catLabel: { fontSize: 14, fontWeight: '600', color: CHAMBA.navy },
  catStatus: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  catIncluded: { fontSize: 11, color: CHAMBA.muted, marginTop: 4, lineHeight: 16 },
  emptyCat: { fontSize: 13, color: CHAMBA.muted, fontWeight: '400' },

  cat2Btn: {
    backgroundColor: CHAMBA.blue,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  cat2BtnRevoke: { backgroundColor: '#B45309' },
  cat2BtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  reviewsCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    ...CARD_STEP_SHADOW,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export const ManageWorkersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const insets        = useSafeAreaInsets();
  const adminProfile  = useAuthStore((s) => s.profile);
  const [teamMode, setTeamMode]         = useState<TeamMode>('workers');
  const [filter, setFilter]             = useState<FilterMode>('all');
  const [selected, setSelected]         = useState<UserProfile | null>(null);
  const [approvingId, setApprovingId]   = useState<string | null>(null);
  const [approvingCat2Id, setAC2Id]     = useState<string | null>(null);

  const { data: workersData, isLoading: workersLoading, refetch: refetchWorkers, isRefetching: workersRefetching } = useQuery<UserProfile[]>({
    queryKey: ['admin', 'workers'],
    queryFn:  fetchAllWorkers,
  });
  const { data: clientsData, isLoading: clientsLoading, refetch: refetchClients, isRefetching: clientsRefetching } = useQuery<UserProfile[]>({
    queryKey: ['admin', 'clients'],
    queryFn:  fetchAllClients,
  });
  const users: UserProfile[] = teamMode === 'workers' ? (workersData ?? []) : (clientsData ?? []);
  const isLoading = teamMode === 'workers' ? workersLoading : clientsLoading;
  const isRefetching = teamMode === 'workers' ? workersRefetching : clientsRefetching;
  const refetch = teamMode === 'workers' ? refetchWorkers : refetchClients;

  const { mutate: toggleApproval } = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      teamMode === 'workers'
        ? toggleWorkerApproval(id, approve)
        : toggleClientApproval(id, approve),
    onMutate:   ({ id }) => setApprovingId(id),
    onSettled:  () => {
      setApprovingId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'workers'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
    onSuccess:  (_data, { approve }) => {
      setSelected((prev) => prev ? {
        ...prev,
        is_approved: approve,
        ...(teamMode === 'workers' ? { worker_status: approve ? 'active' : 'suspended' } : {}),
      } : null);
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

  const filtered = users.filter((w) => {
    if (filter === 'pending')  return !w.is_approved;
    if (filter === 'approved') return w.is_approved;
    return true;
  });

  const pendingCount  = users.filter((w) => !w.is_approved).length;
  const approvedCount = users.filter((w) => w.is_approved).length;
  const clientsPending = (clientsData ?? []).filter((c) => !c.is_approved).length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={chambaStyles.screenHeader}>
        <Text style={chambaStyles.screenTitle}>Equipo y clientes</Text>
        <Text style={chambaStyles.screenSubtitle}>
          {teamMode === 'workers'
            ? 'Gestión de técnicos y verificaciones'
            : 'Aprobación de cuentas de clientes'}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, gap: 12, marginBottom: 4 }}>
        <ChambaGradientTabs
          tabs={[
            { id: 'workers', label: 'Técnicos', badge: workersData?.length ?? 0 },
            { id: 'clients', label: 'Clientes', badge: clientsPending || undefined },
          ]}
          active={teamMode}
          onChange={(id) => {
            setTeamMode(id as TeamMode);
            setFilter('all');
            setSelected(null);
          }}
        />
        <ChambaGradientTabs
          tabs={[
            { id: 'all', label: 'Todos', badge: users.length },
            { id: 'pending', label: 'Pendientes', badge: pendingCount },
            { id: 'approved', label: 'Verificados', badge: approvedCount },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={CHAMBA.blue} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => (
            <WorkerRow
              worker={item}
              isClient={teamMode === 'clients'}
              onOpen={() => teamMode === 'workers' && setSelected(item)}
              onToggle={(approve) => toggleApproval({ id: item.id, approve })}
              toggling={approvingId === item.id}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 100 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={CHAMBA.blue} />
          }
          ListEmptyComponent={
            <View style={chambaStyles.emptyCard}>
              <View style={[chambaStyles.iconCircleRight, { backgroundColor: '#34C759' }]}>
                <Ionicons name="people" size={22} color="#FFF" />
              </View>
              <Text style={styles.emptyTitle}>
                {teamMode === 'workers' ? 'Sin técnicos' : 'Sin clientes'}
              </Text>
              <Text style={styles.emptySub}>
                {filter === 'pending'
                  ? (teamMode === 'workers' ? 'No hay técnicos pendientes' : 'No hay clientes pendientes')
                  : (teamMode === 'workers' ? 'Aún no hay técnicos registrados' : 'Aún no hay clientes registrados')}
              </Text>
            </View>
          }
        />
      )}

      {selected && adminProfile && teamMode === 'workers' && (
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
    </SafeAreaView>
  );
};

// ─── Row (Stitch lista con toggle) ────────────────────────────────────────────

const WorkerRow: React.FC<{
  worker:   UserProfile;
  isClient: boolean;
  onOpen:   () => void;
  onToggle: (approve: boolean) => void;
  toggling: boolean;
}> = ({ worker, isClient, onOpen, onToggle, toggling }) => {
  const { getLabel } = useCatalog();
  const cat1Label = worker.category_1 ? getLabel(worker.category_1) : null;
  const hasDocs   = !!(worker.cedula_url && worker.record_policia_url);
  const phoneDisplay = formatNicaPhoneDisplay(worker.phone);
  const contactLine = phoneDisplay
    ? `${NICA_PHONE_PREFIX} ${phoneDisplay}`
    : (worker.email ?? '—');

  return (
    <View style={styles.workerCard}>
      <TouchableOpacity
        onPress={isClient ? undefined : onOpen}
        activeOpacity={isClient ? 1 : 0.88}
        style={styles.workerMain}
        disabled={isClient}
      >
        <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
          <View style={styles.nameRow}>
            <Text style={styles.workerName}>{worker.full_name}</Text>
            {worker.is_approved && (
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
            )}
          </View>
          <Text style={styles.workerMeta}>
            {contactLine} · {formatDate(worker.created_at)}
          </Text>
          <View style={styles.badgeRow}>
            <Badge
              label={worker.is_approved ? (isClient ? 'Aprobado' : 'Activo') : 'Pendiente'}
              color={worker.is_approved ? '#15803D' : '#B45309'}
              bgColor={worker.is_approved ? '#DCFCE7' : '#FEF3C7'}
              size="sm"
            />
            {isClient ? (
              <Badge label="Cliente" color={CHAMBA.blue} bgColor="#E0F2FE" size="sm" />
            ) : (
              <>
                {hasDocs
                  ? <Badge label="Docs OK" color="#15803D" bgColor="#DCFCE7" size="sm" />
                  : <Badge label="Sin docs" color="#B91C1C" bgColor="#FEE2E2" size="sm" />}
                {cat1Label && (
                  <Badge label={cat1Label} color={CHAMBA.blue} bgColor="#E0F2FE" size="sm" />
                )}
              </>
            )}
          </View>
        </View>
        <View style={[chambaStyles.iconCircleRight, { backgroundColor: worker.is_approved ? '#34C759' : '#FF9500' }]}>
          <Ionicons name="person" size={22} color="#FFF" />
        </View>
      </TouchableOpacity>

      <View style={styles.toggleDivider} />

      <View style={styles.toggleRow}>
        <View style={styles.toggleIconWrap}>
          <Ionicons
            name={worker.is_approved ? 'checkmark-circle' : 'pause-circle'}
            size={20}
            color={worker.is_approved ? '#34C759' : CHAMBA.muted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>
            {worker.is_approved
              ? (isClient ? 'Aprobado — puede usar CHAMBA' : 'Verificado — operando')
              : (isClient ? 'Pendiente de aprobación' : 'Suspendido del radar')}
          </Text>
          <Text style={styles.toggleHint}>
            {worker.is_approved
              ? (isClient ? 'El cliente puede solicitar servicios' : 'El técnico puede aceptar chambas')
              : (isClient ? 'Activa para habilitar la app de servicios' : 'Toggle para reactivar acceso')}
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
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, flexGrow: 1 },
  workerCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    ...CARD_STEP_SHADOW,
  },
  workerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  workerName: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy },
  workerMeta: { fontSize: 12, color: CHAMBA.muted, marginTop: 2, fontWeight: '400' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  toggleDivider: { height: 1, backgroundColor: '#E2E8F0' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
  },
  toggleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#EFF2F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: CHAMBA.navy },
  toggleHint: { fontSize: 11, color: CHAMBA.muted, marginTop: 1, fontWeight: '400' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy, textAlign: 'center' },
  emptySub: { fontSize: 13, color: CHAMBA.muted, textAlign: 'center', fontWeight: '400' },
});
