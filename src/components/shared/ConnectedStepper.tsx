import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACTIVE_SERVICE_PALETTE as PALETTE } from '@constants/activeServiceTheme';
import { OPERATIONAL_STEPS, getStepVisualState, type StepVisualState } from '@utils/workerOperationalPhase';
import type { WorkerOperationalPhase } from '@/types';

const STEP_ICONS: Record<WorkerOperationalPhase, keyof typeof Ionicons.glyphMap> = {
  accepted: 'checkmark',
  en_route: 'car-outline',
  arrived: 'person',
  completed: 'flag-outline',
};

const StepperNode: React.FC<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  state: StepVisualState;
}> = ({ label, icon, state }) => {
  const pulse = useRef(new Animated.Value(state === 'active' ? 0 : 1)).current;

  useEffect(() => {
    if (state !== 'active') return;
    pulse.setValue(0.6);
    Animated.spring(pulse, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
  }, [state, pulse]);

  const circleStyle =
    state === 'done' ? styles.circleDone
      : state === 'active' ? styles.circleActive
      : styles.circleUpcoming;
  const iconColor = state === 'upcoming' ? '#9CA3AF' : '#FFFFFF';
  const labelStyle = state === 'upcoming' ? styles.labelUpcoming : styles.labelActive;

  return (
    <View style={styles.node}>
      <Animated.View style={[styles.circle, circleStyle, { transform: [{ scale: pulse }] }]}>
        <Ionicons name={state === 'done' ? 'checkmark' : icon} size={16} color={iconColor} />
      </Animated.View>
      <Text style={labelStyle} numberOfLines={1}>{label}</Text>
    </View>
  );
};

interface Props {
  phase: WorkerOperationalPhase | null;
}

/** Stepper horizontal conectado — compartido entre la vista del cliente y del
 * técnico para el mismo trabajo, misma fuente de verdad (OPERATIONAL_STEPS). */
export const ConnectedStepper: React.FC<Props> = ({ phase }) => (
  <View style={styles.row}>
    {OPERATIONAL_STEPS.map((step, index) => {
      const state = getStepVisualState(step.phase, phase);
      const isLast = index === OPERATIONAL_STEPS.length - 1;
      return (
        <React.Fragment key={step.phase}>
          <StepperNode label={step.shortLabel} icon={STEP_ICONS[step.phase]} state={state} />
          {!isLast && (
            <View style={[styles.connector, state === 'done' && styles.connectorDone]} />
          )}
        </React.Fragment>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  node: {
    alignItems: 'center',
    width: 56,
    gap: 6,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: PALETTE.green },
  circleActive: { backgroundColor: PALETTE.blue },
  circleUpcoming: { backgroundColor: '#E5E7EB' },
  labelActive: {
    fontSize: 11,
    fontWeight: '600',
    color: PALETTE.text,
    textAlign: 'center',
  },
  labelUpcoming: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 16,
    marginHorizontal: -8,
  },
  connectorDone: { backgroundColor: PALETTE.green },
});
