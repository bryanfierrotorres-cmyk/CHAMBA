import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { JobExpiryBadge } from '@components/shared/JobExpiryBadge';
import { CHAMBA, CARD_STEP_SHADOW } from '@constants/chambaUI';
import { isJobExpiredLocally } from '@constants/jobExpiry';
import { boostClientJobOffer, cancelClientJob } from '@features/jobs/services/jobsService';
import {
  clientOrdersQueryKey,
  patchClientOrderRowInCache,
} from '@features/client/hooks/useClientOrders';
import { formatCurrency, coerceNumber } from '@utils/formatters';
import type { ClientOrderJob } from '@/types';

const BOOST_PRESETS = [100, 200] as const;

interface Props {
  job: ClientOrderJob;
  clientId: string;
  pendingApplicationsCount?: number;
  onExpiredChange?: (expired: boolean) => void;
}

export const ClientOpenJobStatusPanel: React.FC<Props> = ({
  job,
  clientId,
  pendingApplicationsCount = 0,
  onExpiredChange,
}) => {
  const queryClient = useQueryClient();
  const [localExpired, setLocalExpired] = useState(() =>
    isJobExpiredLocally(job.created_at),
  );
  const [showBoostPicker, setShowBoostPicker] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    const expired = isJobExpiredLocally(job.created_at);
    setLocalExpired(expired);
    setShowBoostPicker(false);
    onExpiredChange?.(expired);
  }, [job.created_at, job.id, onExpiredChange]);

  const payAmount = coerceNumber(job.pay_amount, 0);
  const hasApplicants = pendingApplicationsCount > 0;

  const handleExpire = useCallback((_jobId: string) => {
    setLocalExpired(true);
    onExpiredChange?.(true);
    setShowBoostPicker(false);
  }, [onExpiredChange]);

  const handleBoost = useCallback(async (increment: number) => {
    const nextAmount = payAmount + increment;
    if (nextAmount <= 0) return;

    setBoosting(true);
    try {
      const updated = await boostClientJobOffer({
        jobId: job.id,
        clientId,
        payAmount: nextAmount,
      });
      patchClientOrderRowInCache(queryClient, clientId, {
        id: updated.id,
        pay_amount: updated.pay_amount,
        worker_payout: updated.worker_payout,
        platform_fee: updated.platform_fee,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      });
      setLocalExpired(false);
      setShowBoostPicker(false);
      onExpiredChange?.(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo impulsar la solicitud';
      Alert.alert('Impulsar solicitud', msg);
    } finally {
      setBoosting(false);
    }
  }, [clientId, job.id, payAmount, queryClient, onExpiredChange]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancelar Solicitud',
      '¿Estás seguro que deseas cancelar esta solicitud?',
      [
        { text: 'No, mantener', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCanceling(true);
            try {
              const updated = await cancelClientJob(job.id);
              patchClientOrderRowInCache(queryClient, clientId, {
                id: updated.id,
                status: updated.status,
                updated_at: updated.updated_at,
              });
              // El panel se ocultará o mostrará como cancelado automáticamente al cambiar el status
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Error al cancelar la solicitud';
              Alert.alert('Error', msg);
            } finally {
              setCanceling(false);
            }
          },
        },
      ],
    );
  }, [clientId, job.id, queryClient]);

  if (localExpired) {
    return (
      <View style={styles.expiredWrap}>
        <View style={styles.expiredIconCircle}>
          <Ionicons name="time-outline" size={28} color="#B91C1C" />
        </View>
        <Text style={styles.expiredTitle}>Solicitud expirada</Text>
        <Text style={styles.expiredSub}>
          Tu solicitud ha expirado. Nadie ha tomado tu chamba aún.
        </Text>

        {!showBoostPicker ? (
          <TouchableOpacity
            style={styles.boostCta}
            onPress={() => setShowBoostPicker(true)}
            activeOpacity={0.88}
          >
            <Ionicons name="rocket-outline" size={20} color="#FFF" />
            <Text style={styles.boostCtaText}>Impulsar solicitud</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.boostPicker}>
            <Text style={styles.boostPickerTitle}>Aumentá tu presupuesto</Text>
            <Text style={styles.boostPickerSub}>
              Actual: {formatCurrency(payAmount)} · Reinicia 60 min en el radar
            </Text>
            <View style={styles.boostOptionsRow}>
              {BOOST_PRESETS.map((inc) => (
                <TouchableOpacity
                  key={inc}
                  style={styles.boostOptionBtn}
                  disabled={boosting}
                  onPress={() => void handleBoost(inc)}
                  activeOpacity={0.88}
                >
                  {boosting ? (
                    <ActivityIndicator color={CHAMBA.teal} />
                  ) : (
                    <>
                      <Text style={styles.boostOptionAmount}>
                        +{formatCurrency(inc)}
                      </Text>
                      <Text style={styles.boostOptionTotal}>
                        {formatCurrency(payAmount + inc)}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setShowBoostPicker(false)}
              disabled={boosting}
              style={styles.boostCancelBtn}
            >
              <Text style={styles.boostCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.waitingWrap}>
      <View style={styles.radarPulseOuter}>
        <View style={styles.radarPulseInner}>
          <Ionicons name="radio-outline" size={26} color={CHAMBA.blue} />
        </View>
      </View>
      <View style={styles.waitingTextCol}>
        <Text style={styles.waitingTitle}>
          {hasApplicants
            ? `${pendingApplicationsCount} técnico${pendingApplicationsCount === 1 ? '' : 's'} postularon`
            : 'Buscando técnicos…'}
        </Text>
        <Text style={styles.waitingSub}>
          {hasApplicants
            ? 'Revisá los perfiles abajo y elegí a tu técnico'
            : 'Te avisamos en cuanto un técnico se postule'}
        </Text>
        <JobExpiryBadge
          createdAt={job.created_at}
          jobId={job.id}
          tone="client"
          onExpirar={handleExpire}
        />
      </View>
      <TouchableOpacity
        style={styles.cancelActionBtn}
        onPress={handleCancel}
        disabled={canceling}
      >
        {canceling ? (
          <ActivityIndicator size="small" color="#991B1B" />
        ) : (
          <Ionicons name="close-circle-outline" size={24} color="#991B1B" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  waitingWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  radarPulseOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPulseInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_STEP_SHADOW,
  },
  waitingTextCol: { flex: 1, minWidth: 0 },
  waitingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  waitingSub: {
    fontSize: 13,
    color: CHAMBA.muted,
    marginTop: 2,
    lineHeight: 18,
  },
  expiredWrap: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  expiredIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiredTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#991B1B',
    textAlign: 'center',
  },
  expiredSub: {
    fontSize: 14,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 20,
  },
  boostCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: CHAMBA.teal,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minWidth: '100%',
  },
  boostCtaText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
  boostPicker: {
    width: '100%',
    marginTop: 4,
    gap: 10,
  },
  boostPickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CHAMBA.navy,
    textAlign: 'center',
  },
  boostPickerSub: {
    fontSize: 13,
    color: CHAMBA.muted,
    textAlign: 'center',
  },
  boostOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  boostOptionBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 72,
    justifyContent: 'center',
  },
  boostOptionAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: CHAMBA.teal,
  },
  boostOptionTotal: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 2,
  },
  boostCancelBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  boostCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: CHAMBA.muted,
  },
  cancelActionBtn: {
    padding: 8,
    alignSelf: 'flex-start',
  },
});
