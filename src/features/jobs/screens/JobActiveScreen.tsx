import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
  Animated,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@components/Card';
import { ScreenBackButton } from '@components/navigation/ScreenBackButton';
import {
  useActiveJob,
  useCompleteJob,
  useAdvanceOperationalPhase,
} from '../hooks/useJobs';
import { JobOperationalStepper } from '@components/worker/JobOperationalStepper';
import { JobChatEntryButton } from '@components/chat/JobChatEntryButton';
import { showJobChatEntry } from '@features/chat/utils/chatHelpers';
import {
  ensureChatSessionForProfile,
  showChatSessionRequiredAlert,
} from '@features/chat/utils/ensureChatSession';
import { JobBeforeAfterUpload } from '@components/jobs/JobBeforeAfterUpload';
import { useAuthStore } from '@store/authStore';
import {
  OPERATIONAL_STEPS,
  resolveOperationalPhase,
  getStepVisualState,
  isActiveOperationalJob,
} from '@utils/workerOperationalPhase';
import type { WorkerOperationalPhase } from '@/types';
import { WORKER_COLORS as COLORS, M3, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/workerTheme';
import { JobLocationLabel } from '@components/worker/JobLocationLabel';
import { formatCurrency, formatDate, formatTime, getCategoryEmoji, getCategoryLabel } from '@utils/formatters';
import { confirmAction, showMessage } from '@utils/confirmAction';
import { openJobLocationInMaps } from '@utils/openMaps';
import type { JobStackParamList, WorkerTabParamList } from '@/types';

type Route = RouteProp<JobStackParamList, 'JobActive'>;
type StackNav = NativeStackNavigationProp<JobStackParamList, 'JobActive'>;

// ─── Confetti particles ───────────────────────────────────────────────────────

const PARTICLE_COLORS = [
  '#22c55e', '#16a34a', '#4ade80', '#86efac',
  '#F59E0B', '#FCD34D', '#38BDF8', '#818CF8', '#F472B6',
];
const PARTICLE_COUNT = 22;

interface Particle {
  tx: Animated.Value;
  ty: Animated.Value;
  op: Animated.Value;
  sc: Animated.Value;
  color: string;
}

const createParticles = (): Particle[] =>
  Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    tx:    new Animated.Value(0),
    ty:    new Animated.Value(0),
    op:    new Animated.Value(0),
    sc:    new Animated.Value(0),
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  }));

// ─── Success Overlay ──────────────────────────────────────────────────────────

interface SuccessOverlayProps {
  payout: number;
  onDismiss: () => void;
}

const SuccessOverlay: React.FC<SuccessOverlayProps> = ({ payout, onDismiss }) => {
  const bgOpacity   = useRef(new Animated.Value(0)).current;
  const checkScale  = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const particles   = useRef<Particle[]>(createParticles()).current;

  useEffect(() => {
    // Fade in backdrop
    Animated.timing(bgOpacity, {
      toValue: 1, duration: 250, useNativeDriver: true,
    }).start();

    // Bounce-in checkmark
    Animated.spring(checkScale, {
      toValue: 1, friction: 5, tension: 120, delay: 120, useNativeDriver: true,
    }).start();

    // Burst all particles from center
    particles.forEach((p, i) => {
      const angle  = (i / PARTICLE_COUNT) * 2 * Math.PI;
      const radius = 70 + Math.random() * 100;
      const dx     = Math.cos(angle) * radius;
      const dy     = Math.sin(angle) * radius;

      Animated.parallel([
        Animated.sequence([
          Animated.timing(p.sc, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(p.sc, { toValue: 0, duration: 380, delay: 220, useNativeDriver: true }),
        ]),
        Animated.timing(p.tx, { toValue: dx, duration: 720, useNativeDriver: true }),
        Animated.timing(p.ty, { toValue: dy, duration: 720, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.op, { toValue: 1, duration: 80,  useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0, duration: 380, delay: 280, useNativeDriver: true }),
        ]),
      ]).start();
    });

    // Fade in text
    Animated.timing(textOpacity, {
      toValue: 1, duration: 420, delay: 550, useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlayBg, { opacity: bgOpacity }]}
    >
      {/* Burst particles */}
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 11,
            height: 11,
            borderRadius: 3,
            backgroundColor: p.color,
            transform: [
              { translateX: p.tx },
              { translateY: p.ty },
              { scale: p.sc },
            ],
            opacity: p.op,
          }}
        />
      ))}

      {/* Checkmark circle */}
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
        <Ionicons name="checkmark" size={50} color={COLORS.brand[400]} />
      </Animated.View>

      {/* Text + CTA */}
      <Animated.View style={{ alignItems: 'center', marginTop: SPACING.xl, opacity: textOpacity }}>
        <Text style={styles.overlayTitle}>¡Chamba Completada! 🎉</Text>
        <Text style={styles.overlaySubtitle}>
          Tu pago de {formatCurrency(payout)} está en camino 🚀
        </Text>
        <TouchableOpacity onPress={onDismiss} style={styles.overlayBtn}>
          <Ionicons name="briefcase" size={18} color={COLORS.text.inverse} />
          <Text style={styles.overlayBtnText}>Ver Mis Chambas</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// ─── Timeline Step ────────────────────────────────────────────────────────────

type StepState = 'done' | 'active' | 'upcoming';

interface TimelineStepProps {
  label: string;
  sublabel?: string;
  state: StepState;
  isLast?: boolean;
}

const TimelineStep: React.FC<TimelineStepProps> = ({
  label, sublabel, state, isLast = false,
}) => {
  const dotBg =
    state === 'done'     ? COLORS.brand[500]    :
    state === 'active'   ? COLORS.status.inProgress :
    COLORS.bg.elevated;

  const dotBorder =
    state === 'done'   ? COLORS.brand[500]    :
    state === 'active' ? COLORS.status.inProgress :
    COLORS.border.default;

  const labelColor =
    state === 'upcoming' ? COLORS.text.muted : COLORS.text.primary;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {/* Dot + line */}
      <View style={{ alignItems: 'center', width: 28 }}>
        <View style={[styles.stepDot, { backgroundColor: dotBg, borderColor: dotBorder }]}>
          {state === 'done' && (
            <Ionicons name="checkmark" size={14} color={COLORS.text.inverse} />
          )}
          {state === 'active' && (
            <View style={styles.activePulse} />
          )}
        </View>
        {!isLast && <View style={styles.stepLine} />}
      </View>

      {/* Text */}
      <View style={{ flex: 1, paddingLeft: SPACING.sm, paddingBottom: SPACING.lg }}>
        <Text style={{ color: labelColor, fontSize: FONT_SIZE.md, fontWeight: '700' }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ color: COLORS.text.muted, fontSize: FONT_SIZE.xs, marginTop: 2 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

// ─── Quick Action Button ──────────────────────────────────────────────────────

const QuickAction: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}> = ({ icon, label, onPress, variant = 'secondary' }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={[styles.quickAction, variant === 'primary' && styles.quickActionPrimary]}
  >
    <Ionicons
      name={icon}
      size={20}
      color={variant === 'primary' ? COLORS.text.inverse : COLORS.brand[400]}
    />
    <Text style={[
      styles.quickActionLabel,
      variant === 'primary' && { color: COLORS.text.inverse },
    ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const JobActiveScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<StackNav>();
  const { jobId }  = route.params;
  const profile = useAuthStore((s) => s.profile);
  const workerId = profile?.id;

  const { data, isLoading, error } = useActiveJob(jobId);
  const { mutateAsync: advanceMut, isPending: isAdvancing } = useAdvanceOperationalPhase();
  const { mutateAsync: completeMut, isPending: isCompleting } = useCompleteJob();

  const [showSuccess, setShowSuccess] = useState(false);

  const handleOpenChat = useCallback(async (readOnly: boolean) => {
    if (!profile) return;
    const ready = await ensureChatSessionForProfile(profile);
    if (!ready) {
      showChatSessionRequiredAlert();
      return;
    }
    navigation.navigate('JobChat', { jobId, readOnly });
  }, [profile, navigation, jobId]);

  const job        = data?.job;
  const assignment = data?.assignment;
  const operationalPhase = resolveOperationalPhase(job);

  const handleAdvance = useCallback(async (nextPhase: WorkerOperationalPhase) => {
    try {
      await advanceMut({ jobId, nextPhase, job: job ?? null });
      if (nextPhase === 'en_route') {
        showMessage('En camino', 'El cliente fue notificado de que vas al destino.');
      } else if (nextPhase === 'arrived') {
        showMessage('Llegaste', 'El cliente fue notificado de que estás en el lugar.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar';
      showMessage('Error', msg);
    }
  }, [jobId, advanceMut, job]);

  const handleComplete = useCallback(async () => {
    if (!assignment) return;
    const confirmed = await confirmAction({
      title: '¿Marcar como terminado?',
      message: 'Confirma que el trabajo ha sido completado satisfactoriamente.',
      confirmLabel: '¡Terminado!',
    });
    if (!confirmed) return;
    try {
      await completeMut({ jobId, assignmentId: assignment.id, job: job ?? null });
      setShowSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al completar';
      showMessage('Error', msg);
    }
  }, [jobId, assignment, completeMut]);

  const handleOpenMap = useCallback(() => {
    if (!job?.location) return;
    void openJobLocationInMaps({
      lat: job.location.lat,
      lng: job.location.lng,
      address: job.location.address,
    });
  }, [job]);

  const handleDismissSuccess = useCallback(() => {
    setShowSuccess(false);
    navigation
      .getParent<BottomTabNavigationProp<WorkerTabParamList>>()
      ?.navigate('MyJobs');
  }, [navigation]);

  // ── Loading / Error states ────────────────────────────────────────────────
  if (isLoading || !job || !assignment) {
    return (
      <View style={styles.center}>
        {isLoading
          ? <ActivityIndicator size="large" color={COLORS.brand[500]} />
          : <Text style={{ color: COLORS.error }}>
              {error instanceof Error ? error.message : 'No se pudo cargar'}
            </Text>
        }
      </View>
    );
  }

  const showOperational = isActiveOperationalJob(job);
  const isCompleted = job.status === 'completed';
  const canUploadPhotos =
  job.status === 'in_progress' || job.status === 'completed' || job.status === 'taken';

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg.primary }}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <ScreenBackButton onPress={() => navigation.goBack()} color={COLORS.text.primary} />
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={styles.headerLabel}>Trabajo Activo</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{job.title}</Text>
        </View>
        <Text style={{ fontSize: 28 }}>{getCategoryEmoji(job.category)}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Pay Summary ── */}
        <Card elevated style={{ borderColor: COLORS.brand[700], borderWidth: 1 }}>
          <Text style={styles.sectionMicro}>TU GANANCIA</Text>
          <Text style={styles.payoutBig}>{formatCurrency(job.worker_payout)}</Text>
          <View style={{ marginTop: SPACING.sm, marginBottom: SPACING.xs }}>
            <JobLocationLabel address={job.location?.address} />
          </View>
          <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm }}>
            <InfoPill icon="time-outline"    label={`${job.duration_hours}h`} />
            <InfoPill icon="apps-outline"     label={getCategoryLabel(job.category)} />
          </View>
        </Card>

        {/* ── Línea de tiempo operativa ── */}
        <Card>
          <Text style={styles.sectionMicro}>LÍNEA DE TIEMPO</Text>
          <Text style={styles.assignedHint}>
            Aceptado {formatDate(assignment.assigned_at)} · {formatTime(assignment.assigned_at)}
          </Text>
          {showOperational ? (
            <JobOperationalStepper
              job={job}
              onAdvance={handleAdvance}
              onFinalize={handleComplete}
              isAdvancing={isAdvancing || isCompleting}
              showQuickActions={false}
            />
          ) : (
            <View style={{ marginTop: SPACING.md }}>
              {OPERATIONAL_STEPS.map((step, index) => (
                <TimelineStep
                  key={step.phase}
                  label={step.label}
                  sublabel={
                    step.phase === 'completed' && assignment.completed_at
                      ? `${formatDate(assignment.completed_at)} · ${formatTime(assignment.completed_at)}`
                      : undefined
                  }
                  state={getStepVisualState(step.phase, operationalPhase)}
                  isLast={index === OPERATIONAL_STEPS.length - 1}
                />
              ))}
            </View>
          )}
        </Card>

        {/* ── Mensajes con cliente ── */}
        {showJobChatEntry(job.status) && (
          <JobChatEntryButton
            variant="worker"
            fullWidth
            readOnly={isCompleted}
            onPress={() => void handleOpenChat(isCompleted)}
          />
        )}

        {/* ── Quick Actions ── */}
        {!isCompleted && (
        <View style={{ gap: SPACING.sm }}>
          <Text style={styles.sectionMicro}>ACCESOS RÁPIDOS</Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <QuickAction
                icon="map"
                label="Abrir en Mapa"
                onPress={handleOpenMap}
              />
            </View>
          </View>
        </View>
        )}

        {canUploadPhotos && workerId && (
          <Card>
            <JobBeforeAfterUpload job={job} workerId={workerId} />
          </Card>
        )}

        {/* ── Description ── */}
        <Card>
          <Text style={styles.sectionMicro}>DESCRIPCIÓN</Text>
          <Text style={{ color: COLORS.text.primary, fontSize: FONT_SIZE.md, lineHeight: 22, marginTop: SPACING.sm }}>
            {job.description}
          </Text>
        </Card>
      </ScrollView>

      {/* ── Confetti / Success Overlay ── */}
      {showSuccess && (
        <SuccessOverlay payout={job.worker_payout} onDismiss={handleDismissSuccess} />
      )}
    </View>
  );
};

// ─── InfoPill ─────────────────────────────────────────────────────────────────

const InfoPill: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  truncate?: boolean;
}> = ({ icon, label, truncate }) => (
  <View style={styles.infoPill}>
    <Ionicons name={icon} size={12} color={COLORS.brand[500]} />
    <Text
      style={styles.infoPillText}
      numberOfLines={truncate ? 1 : undefined}
    >
      {label}
    </Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1, backgroundColor: COLORS.bg.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
    gap: SPACING.sm,
  },
  headerLabel: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  headerTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  sectionMicro: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  assignedHint: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
  },
  payoutBig: {
    color: COLORS.brand[400],
    fontSize: FONT_SIZE['4xl'],
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 4,
  },
  // Timeline
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.status.inProgress,
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: SPACING.lg,
    backgroundColor: COLORS.border.subtle,
    marginTop: 2,
  },
  // Quick actions
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.bg.card,
    borderWidth: 1,
    borderColor: COLORS.brand[700],
  },
  quickActionPrimary: {
    backgroundColor: COLORS.brand[500],
    borderColor: COLORS.brand[500],
  },
  quickActionLabel: {
    color: COLORS.brand[400],
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  // Info pill
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  infoPillText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.xs,
    flex: 1,
  },
  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bg.primary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.subtle,
    padding: SPACING.lg,
  },
  mainActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md + 2,
  },
  mainActionLabel: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  // Overlay
  overlayBg: {
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#052e16',
    borderWidth: 3,
    borderColor: COLORS.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE['2xl'],
    fontWeight: '900',
    textAlign: 'center',
  },
  overlaySubtitle: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.md,
    marginTop: 6,
    textAlign: 'center',
  },
  overlayBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.brand[500],
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overlayBtnText: {
    color: COLORS.text.inverse,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});
