import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { CHAMBA, CARD_STEP_SHADOW } from '@constants/chambaUI';
import { getCategoryLabel } from '@utils/formatters';
import { formatNicaPhoneDisplay } from '@utils/phoneNicaragua';
import { summarizeWorkerTrust } from '@utils/workerTrustSummary';
import {
  clientApproveWorkerApplication,
  clientRejectWorkerApplication,
} from '@features/client/services/clientJobSelectionService';
import { useJobWorkerApplications } from '@features/client/hooks/useJobWorkerApplications';
import type { JobWorkerApplication } from '@/types';

interface ClientJobApplicantPanelProps {
  jobId: string;
  clientId: string;
  jobStatus: string;
  onDecision?: () => void;
}

export const ClientJobApplicantPanel: React.FC<ClientJobApplicantPanelProps> = ({
  jobId,
  clientId,
  jobStatus,
  onDecision,
}) => {
  const enabled = jobStatus === 'open';
  const {
    data: apps = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useJobWorkerApplications(jobId, clientId, enabled);
  const [actingId, setActingId] = useState<string | null>(null);
  const error = queryError instanceof Error ? queryError.message : null;

  const pending = apps.filter((a) => a.selection_status === 'pending');
  const canChoose = jobStatus === 'open' && pending.length > 0;

  const handleApprove = async (app: JobWorkerApplication) => {
    const msg = `¿Confirmás a ${app.full_name} para este servicio?`;
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
    } else {
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert('Elegir técnico', msg, [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Aprobar', onPress: () => resolve(true) },
        ]);
      });
      if (!ok) return;
    }

    setActingId(app.worker_id);
    try {
      await clientApproveWorkerApplication(jobId, clientId, app.worker_id);
      onDecision?.();
      await refetch();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'No se pudo aprobar';
      if (Platform.OS === 'web') window.alert(text);
      else Alert.alert('Error', text);
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (app: JobWorkerApplication) => {
    setActingId(app.worker_id);
    try {
      await clientRejectWorkerApplication(jobId, clientId, app.worker_id);
      await refetch();
      onDecision?.();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'No se pudo rechazar';
      if (Platform.OS === 'web') window.alert(text);
      else Alert.alert('Error', text);
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={CHAMBA.blue} />
        <Text style={styles.hint}>Cargando técnicos interesados…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.box}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity onPress={() => void refetch()}>
          <Text style={styles.retry}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (pending.length === 0 && apps.length === 0) {
    return (
      <View style={styles.box}>
        <Text style={styles.hint}>Aún no hay técnicos postulando. Te avisamos cuando lleguen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        {canChoose
          ? `Elegí tu técnico (${pending.length}/3 postulaciones)`
          : 'Técnicos que postularon'}
      </Text>
      {canChoose && (
        <Text style={styles.subtitle}>
          Revisá el perfil de cada uno y aprobá solo al que quieras que realice el servicio.
        </Text>
      )}

      {apps.map((app) => {
        const isPending = app.selection_status === 'pending';
        const busy = actingId === app.worker_id;
        const specs = [app.category_1, app.category_2]
          .filter(Boolean)
          .map((c) => getCategoryLabel(c as string))
          .join(' · ');
        const trust = summarizeWorkerTrust(app);

        return (
          <View key={app.assignment_id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Avatar uri={app.avatar_url} name={app.full_name} size={52} />
              <View style={styles.cardInfo}>
                <Text style={styles.name}>{app.full_name}</Text>
                {app.phone ? (
                  <Text style={styles.meta}>{formatNicaPhoneDisplay(app.phone)}</Text>
                ) : null}
                {specs ? <Text style={styles.meta}>{specs}</Text> : null}
                <View style={styles.badgeRow}>
                  {trust.starLabel ? (
                    <View style={styles.trustBadge}>
                      <Text style={styles.trustBadgeText}>{trust.starLabel}</Text>
                    </View>
                  ) : null}
                  {trust.jobsLabel ? (
                    <View style={[styles.trustBadge, trust.isNew && styles.trustBadgeNew]}>
                      <Text style={[styles.trustBadgeText, trust.isNew && styles.trustBadgeTextNew]}>
                        {trust.jobsLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {!isPending && (
                <View
                  style={[
                    styles.statusPill,
                    app.selection_status === 'approved' && styles.statusApproved,
                    app.selection_status === 'rejected' && styles.statusRejected,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {app.selection_status === 'approved' ? 'Elegido' : 'Rechazado'}
                  </Text>
                </View>
              )}
            </View>

            {isPending && canChoose && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.rejectBtn, busy && styles.btnDisabled]}
                  onPress={() => void handleReject(app)}
                  disabled={busy}
                >
                  <Text style={styles.rejectText}>Rechazar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, busy && styles.btnDisabled]}
                  onPress={() => void handleApprove(app)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                      <Text style={styles.approveText}>Aprobar técnico</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 10 },
  box: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: '800', color: CHAMBA.navy },
  subtitle: { fontSize: 12, color: CHAMBA.muted, lineHeight: 18, marginBottom: 4 },
  hint: { fontSize: 13, color: CHAMBA.muted, textAlign: 'center' },
  error: { fontSize: 13, color: '#DC2626', textAlign: 'center' },
  retry: { fontSize: 13, fontWeight: '700', color: CHAMBA.blue },
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...CARD_STEP_SHADOW,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardInfo: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '800', color: CHAMBA.navy },
  meta: { fontSize: 12, color: CHAMBA.muted },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  trustBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trustBadgeNew: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  trustBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  trustBadgeTextNew: {
    color: '#1E40AF',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  statusApproved: { backgroundColor: '#DCFCE7' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 10, fontWeight: '800', color: CHAMBA.navy },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  rejectText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  approveBtn: {
    flex: 1.4,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: CHAMBA.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  btnDisabled: { opacity: 0.6 },
});
