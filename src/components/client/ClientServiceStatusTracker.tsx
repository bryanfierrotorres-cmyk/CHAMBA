import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CHAMBA, CARD_STEP_SHADOW } from '@constants/chambaUI';
import { getClientOrderStatusLabel } from '@utils/formatters';
import {
  OPERATIONAL_STEPS,
  resolveOperationalPhase,
  getStepVisualState,
  type StepVisualState,
} from '@utils/workerOperationalPhase';
import type { ClientOrderJob } from '@/types';

interface Props {
  job: Pick<ClientOrderJob, 'status' | 'operational_phase'>;
  pendingApplicationsCount?: number;
}

const StepNode: React.FC<{ state: StepVisualState; label: string }> = ({ state, label }) => {
  const done = state === 'done';
  const active = state === 'active';

  return (
    <View style={styles.stepNode}>
      <View
        style={[
          styles.dot,
          done && styles.dotDone,
          active && styles.dotActive,
          !done && !active && styles.dotUpcoming,
        ]}
      >
        {done ? (
          <Ionicons name="checkmark" size={14} color="#FFF" />
        ) : active ? (
          <View style={styles.dotPulse} />
        ) : (
          <View style={styles.dotEmpty} />
        )}
      </View>
      <Text
        style={[
          styles.stepLabel,
          active && styles.stepLabelActive,
          done && styles.stepLabelDone,
          !done && !active && styles.stepLabelMuted,
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
};

const Connector: React.FC<{ filled: boolean }> = ({ filled }) => (
  <View style={[styles.connector, filled && styles.connectorFilled]} />
);

export const ClientServiceStatusTracker: React.FC<Props> = ({
  job,
  pendingApplicationsCount = 0,
}) => {
  const phase = resolveOperationalPhase(job);
  const headline = getClientOrderStatusLabel(job.status, job.operational_phase);

  if (job.status === 'open') {
    const hasApplicants = pendingApplicationsCount > 0;
    return (
      <View style={styles.openBanner}>
        <Ionicons name="people-outline" size={22} color={CHAMBA.blue} />
        <View style={styles.openTextWrap}>
          <Text style={styles.openTitle}>
            {hasApplicants
              ? `${pendingApplicationsCount} técnico${pendingApplicationsCount === 1 ? '' : 's'} postularon`
              : 'Esperando postulaciones'}
          </Text>
          <Text style={styles.openSub}>
            {hasApplicants
              ? 'Revisá los perfiles abajo y elegí a tu técnico'
              : 'Te avisamos en cuanto un técnico se postule'}
          </Text>
        </View>
      </View>
    );
  }

  if (job.status === 'cancelled') {
    return (
      <View style={[styles.openBanner, styles.cancelBanner]}>
        <Ionicons name="close-circle-outline" size={22} color="#B91C1C" />
        <Text style={styles.cancelTitle}>Servicio cancelado</Text>
      </View>
    );
  }

  const currentRank = phase ? OPERATIONAL_STEPS.findIndex((s) => s.phase === phase) : -1;

  return (
    <View style={styles.wrap}>
      <Text style={styles.headline}>{headline}</Text>
      <View style={styles.trackRow}>
        {OPERATIONAL_STEPS.map((step, index) => {
          const visual = getStepVisualState(step.phase, phase);
          const connectorFilled = currentRank > index;
          return (
            <React.Fragment key={step.phase}>
              <StepNode state={visual} label={step.label} />
              {index < OPERATIONAL_STEPS.length - 1 && (
                <Connector filled={connectorFilled} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#99F6E4',
    ...CARD_STEP_SHADOW,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    color: CHAMBA.navy,
    letterSpacing: -0.3,
    marginBottom: 14,
    textAlign: 'center',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNode: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: CHAMBA.teal,
    borderColor: CHAMBA.teal,
  },
  dotActive: {
    backgroundColor: '#ECFEFF',
    borderColor: CHAMBA.blue,
  },
  dotUpcoming: {
    backgroundColor: '#F1F5F9',
    borderColor: CHAMBA.border,
  },
  dotPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CHAMBA.blue,
  },
  dotEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: CHAMBA.navy,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 14,
  },
  stepLabelActive: {
    color: CHAMBA.blue,
    fontWeight: '800',
    fontSize: 12,
  },
  stepLabelDone: {
    color: CHAMBA.teal,
  },
  stepLabelMuted: {
    color: CHAMBA.muted,
    fontWeight: '500',
  },
  connector: {
    flex: 0.35,
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginTop: 13,
    marginHorizontal: -2,
  },
  connectorFilled: {
    backgroundColor: CHAMBA.teal,
  },
  openBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  openTextWrap: { flex: 1 },
  openTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  openSub: {
    fontSize: 13,
    color: CHAMBA.muted,
    marginTop: 2,
    lineHeight: 18,
  },
  cancelBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  cancelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B91C1C',
    flex: 1,
  },
});
