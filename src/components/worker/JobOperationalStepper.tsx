import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { M3, SPACING } from '@constants/stitchStyles';
import { CHAMBA } from '@constants/chambaUI';
import type { Job, WorkerOperationalPhase } from '@/types';
import {
  OPERATIONAL_STEPS,
  resolveOperationalPhase,
  getPhaseAction,
  getStepVisualState,
  type StepVisualState,
} from '@utils/workerOperationalPhase';
import { JobQuickContactActions } from './JobQuickContactActions';
import { StatusMarker } from '@features/workers/components/static/StatusMarker';

interface Props {
  job: Partial<Job>;
  clientPhone?: string | null;
  onAdvance?: (nextPhase: WorkerOperationalPhase) => void | Promise<void>;
  onFinalize?: () => void | Promise<void>;
  onOpenChat?: () => void;
  isAdvancing?: boolean;
  showQuickActions?: boolean;
  compact?: boolean;
}

export const JobOperationalStepper: React.FC<Props> = ({
  job,
  clientPhone,
  onAdvance,
  onFinalize,
  onOpenChat,
  isAdvancing = false,
  showQuickActions = true,
  compact = false,
}) => {
  const phase = resolveOperationalPhase(job);
  const action = getPhaseAction(phase);
  const isTerminal = phase === 'completed' || job.status === 'completed';

  const handlePrimary = (e?: GestureResponderEvent) => {
    if (Platform.OS === 'web') {
      e?.stopPropagation?.();
    }
    if (!phase || !action) return;
    if (phase === 'arrived') {
      void onFinalize?.();
      return;
    }
    const next = phase === 'accepted' ? 'en_route' : phase === 'en_route' ? 'arrived' : null;
    if (next) void onAdvance?.(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.stepperRow}>
        {OPERATIONAL_STEPS.map((step, index) => {
          const visual = getStepVisualState(step.phase, phase);
          const markerStatus = visual === 'done' ? 'completed' : visual === 'active' ? 'in_progress' : 'pending';
          return (
            <View key={step.phase} style={styles.stepItem}>
              <StatusMarker status={markerStatus} />
              <Text
                style={[
                  styles.stepLabel,
                  visual === 'active' && styles.stepLabelActive,
                  visual === 'upcoming' && styles.stepLabelMuted,
                ]}
                numberOfLines={1}
              >
                {compact ? step.shortLabel : step.label}
              </Text>
            </View>
          );
        })}
      </View>

      {(showQuickActions || action || onOpenChat) && !isTerminal && (
        <View style={styles.actionsRow}>
          {showQuickActions && (
            <JobQuickContactActions
              clientPhone={clientPhone}
              jobTitle={job.title}
              compact
            />
          )}
          {onOpenChat && (
            <TouchableOpacity
              onPress={(e) => {
                if (Platform.OS === 'web') e?.stopPropagation?.();
                onOpenChat();
              }}
              style={styles.chatBtn}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Mensajes con el cliente"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={CHAMBA.blue} />
            </TouchableOpacity>
          )}
          {action && (
            <TouchableOpacity
              onPress={handlePrimary}
              disabled={isAdvancing}
              style={[
                styles.primaryBtn,
                (showQuickActions || onOpenChat) && { flex: 1 },
              ]}
              activeOpacity={0.88}
            >
              {isAdvancing ? (
                <ActivityIndicator color={M3.onPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name={action.icon} size={18} color={M3.onPrimary} />
                  <Text style={styles.primaryBtnText} numberOfLines={2}>
                    {action.label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: M3.primary,
    borderColor: M3.primary,
  },
  dotActive: {
    backgroundColor: '#EFF6FF',
    borderColor: CHAMBA.blue,
  },
  dotUpcoming: {
    backgroundColor: '#F1F5F9',
    borderColor: CHAMBA.border,
  },
  dotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CHAMBA.blue,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: CHAMBA.navy,
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: CHAMBA.blue,
    fontWeight: '700',
  },
  stepLabelMuted: {
    color: CHAMBA.muted,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${CHAMBA.blue}40`,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: M3.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  primaryBtnText: {
    color: M3.onPrimary,
    fontWeight: '700',
    fontSize: 13,
    flexShrink: 1,
  },
});
