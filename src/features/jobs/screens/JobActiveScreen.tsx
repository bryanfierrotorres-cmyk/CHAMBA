import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
  Animated, Linking,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@components/Card';
import { Avatar } from '@components/Avatar';
import MapView from '@components/maps/ChambaMap';
import { ChambaMapMarker } from '@components/maps/ChambaMapMarker';
import { ConnectedStepper } from '@components/shared/ConnectedStepper';
import { ACTIVE_SERVICE_PALETTE as PALETTE, ACTIVE_SERVICE_CARD_SHADOW as CARD_SHADOW } from '@constants/activeServiceTheme';
import {
  useActiveJob,
  useCompleteJob,
  useAdvanceOperationalPhase,
} from '../hooks/useJobs';
import { WorkerRatingPrompt } from '@components/reviews/WorkerRatingPrompt';
import { JobChatEntryButton } from '@components/chat/JobChatEntryButton';
import { showJobChatEntry } from '@features/chat/utils/chatHelpers';
import {
  ensureChatSessionForProfile,
  showChatSessionRequiredAlert,
} from '@features/chat/utils/ensureChatSession';
import { JobBeforeAfterUpload } from '@components/jobs/JobBeforeAfterUpload';
import { useAuthStore } from '@store/authStore';
import {
  resolveOperationalPhase,
  getPhaseAction,
  isActiveOperationalJob,
  OPERATIONAL_STEPS,
} from '@utils/workerOperationalPhase';
import type { WorkerOperationalPhase } from '@/types';
import { WORKER_COLORS as COLORS, FONT_SIZE, SPACING } from '@constants/workerTheme';
import { formatCurrency, formatDate, formatRelativeTime, formatTime, getCategoryIconName, getCategoryLabel } from '@utils/formatters';
import { confirmAction, showMessage } from '@utils/confirmAction';
import { openJobLocationInMaps } from '@utils/openMaps';
import { openWhatsAppSupport } from '@utils/whatsappSupport';
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
// (sin cambios — celebración post-finalización, fuera del alcance de este rediseño)

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
    Animated.timing(bgOpacity, {
      toValue: 1, duration: 250, useNativeDriver: true,
    }).start();

    Animated.spring(checkScale, {
      toValue: 1, friction: 5, tension: 120, delay: 120, useNativeDriver: true,
    }).start();

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

    Animated.timing(textOpacity, {
      toValue: 1, duration: 420, delay: 550, useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlayBg, { opacity: bgOpacity }]}
    >
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

      <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
        <Ionicons name="checkmark" size={50} color={COLORS.brand[400]} />
      </Animated.View>

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

// ─── Acción rápida (icono circular + etiqueta) ────────────────────────────────

const QuickActionButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}> = ({ icon, label, disabled, onPress }) => (
  <TouchableOpacity
    style={styles.quickActionWrap}
    activeOpacity={0.8}
    disabled={disabled}
    onPress={onPress}
  >
    <View style={[styles.quickActionCircle, disabled && styles.quickActionCircleDisabled]}>
      <Ionicons name={icon} size={20} color={disabled ? '#9CA3AF' : PALETTE.blue} />
    </View>
    <Text
      style={[styles.quickActionLabel, disabled && styles.quickActionLabelDisabled]}
      numberOfLines={2}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

/** Mensaje contextual desde el punto de vista del TÉCNICO (no existe un
 * equivalente compartido con el cliente — getClientPhaseMessage está escrito
 * desde el lado del cliente — así que este vive acá, copy nuevo pero sin
 * tocar ningún archivo compartido ni lógica de negocio). */
const resolveWorkerBannerMessage = (
  phase: WorkerOperationalPhase | null,
  updatedAt: string,
): { title: string; sub: string } | null => {
  switch (phase) {
    case 'accepted':
      return { title: 'Aceptaste esta chamba', sub: 'Iniciá el viaje cuando estés listo.' };
    case 'en_route':
      return { title: 'Vas en camino', sub: `Actualizado ${formatRelativeTime(updatedAt)}` };
    case 'arrived':
      return { title: 'Estás en el sitio del cliente', sub: `Llegaste ${formatRelativeTime(updatedAt)}` };
    case 'completed':
      return { title: 'Servicio finalizado', sub: 'Recordá pedirle una calificación al cliente.' };
    default:
      return null;
  }
};

/** Insignia de fase — mismo copy de OPERATIONAL_STEPS (fuente única de verdad),
 * solo se le agrega color acá para el look de la tarjeta hero. */
const PHASE_BADGE_COLOR: Record<WorkerOperationalPhase, { bg: string; fg: string }> = {
  accepted: { bg: PALETTE.blueSoft, fg: PALETTE.blue },
  en_route: { bg: PALETTE.blueSoft, fg: PALETTE.blue },
  arrived: { bg: PALETTE.orangeSoft, fg: PALETTE.orange },
  completed: { bg: PALETTE.greenSoft, fg: PALETTE.green },
};

const resolveWorkerPhaseBadge = (
  phase: WorkerOperationalPhase | null,
): { label: string; bg: string; fg: string } | null => {
  if (!phase) return null;
  const step = OPERATIONAL_STEPS.find((s) => s.phase === phase);
  if (!step) return null;
  return { label: step.label, ...PHASE_BADGE_COLOR[phase] };
};

/** hh:mm:ss para el cronómetro de "tiempo transcurrido en el sitio". */
const formatElapsed = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const JobActiveScreen: React.FC = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<StackNav>();
  const { jobId }  = route.params;
  const profile = useAuthStore((s) => s.profile);
  const workerId = profile?.id;

  const { data, isLoading, error, refetch } = useActiveJob(jobId);
  const { mutateAsync: advanceMut, isPending: isAdvancing } = useAdvanceOperationalPhase();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );
  const { mutateAsync: completeMut, isPending: isCompleting } = useCompleteJob();

  const [showSuccess, setShowSuccess] = useState(false);
  const [phaseConfirmed, setPhaseConfirmed] = useState<WorkerOperationalPhase | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const photoSectionY = useRef(0);

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
    setPhaseConfirmed(nextPhase);
    const clearConfirm = setTimeout(() => setPhaseConfirmed(null), 4000);
    try {
      await advanceMut({ jobId, nextPhase, job: job ?? null });
    } catch (err: unknown) {
      clearTimeout(clearConfirm);
      setPhaseConfirmed(null);
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar';
      showMessage('Error al actualizar estado', msg);
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

  /** Mismo despacho que ya usaba JobOperationalStepper internamente — solo
   * se movió el botón fuera de ese componente compartido para no afectar su
   * otro uso en MyJobsScreen (tema oscuro). Cero lógica nueva. */
  const handlePrimaryAction = useCallback(() => {
    if (!operationalPhase) return;
    if (operationalPhase === 'arrived') {
      void handleComplete();
      return;
    }
    const next = operationalPhase === 'accepted' ? 'en_route' : operationalPhase === 'en_route' ? 'arrived' : null;
    if (next) void handleAdvance(next);
  }, [operationalPhase, handleComplete, handleAdvance]);

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

  // ── Cronómetro "tiempo en el sitio" — solo corre durante la fase 'arrived',
  // usando job.updated_at (el timestamp real de la última transición) como
  // referencia. No se agrega ningún campo nuevo al backend. ──
  useEffect(() => {
    if (!job || operationalPhase !== 'arrived') {
      setElapsedSec(0);
      return;
    }
    const startMs = new Date(job.updated_at).getTime();
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [job, operationalPhase]);

  // ── Acciones rápidas: reutilizan lógica ya existente en la app (chat,
  // WhatsApp de soporte) — no se agrega ningún RPC ni endpoint nuevo. ──
  const handleCallClient = useCallback(() => {
    const phone = job?.creator?.phone;
    if (!phone) {
      showMessage('Sin número', 'El cliente no tiene teléfono registrado.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() =>
      showMessage('Error', 'No se pudo abrir el marcador.'),
    );
  }, [job]);

  const handleQuickPhoto = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, photoSectionY.current - 16), animated: true });
  }, []);

  const handleReportProblem = useCallback(() => {
    void openWhatsAppSupport(`Hola, tengo un problema con la chamba "${job?.title ?? ''}".`);
  }, [job]);

  const handleRequestMoreTime = useCallback(() => {
    void handleOpenChat(false);
  }, [handleOpenChat]);

  const handleCancelViaSupport = useCallback(() => {
    void openWhatsAppSupport(`Hola, quiero cancelar mi chamba "${job?.title ?? ''}".`);
  }, [job]);

  // ── Loading / Error states ────────────────────────────────────────────────
  if (isLoading || !job || !assignment) {
    return (
      <View style={styles.center}>
        {isLoading
          ? <ActivityIndicator size="large" color={PALETTE.blue} />
          : <Text style={{ color: PALETTE.red }}>
              {error instanceof Error ? error.message : 'No se pudo cargar'}
            </Text>
        }
      </View>
    );
  }

  const isCompleted = job.status === 'completed';
  const canUploadPhotos =
    job.status === 'in_progress' || job.status === 'completed' || job.status === 'taken';
  const hasCoords = !!job.location?.lat && !!job.location?.lng;
  const clientName = job.creator?.full_name ?? 'Cliente';
  const banner = !isCompleted ? resolveWorkerBannerMessage(operationalPhase, job.updated_at) : null;
  const primaryAction = !isCompleted ? getPhaseAction(operationalPhase) : null;
  const phaseBadge = !isCompleted ? resolveWorkerPhaseBadge(operationalPhase) : null;
  const canChatNow = showJobChatEntry(job.status);
  const scheduledLabel = job.scheduled_at
    ? `${formatDate(job.scheduled_at)} · ${formatTime(job.scheduled_at)}`
    : `${formatDate(assignment.assigned_at)} · ${formatTime(assignment.assigned_at)}`;

  // "Tiempo estimado restante" — derivado de la duración estimada del job
  // (job.duration_hours, dato ya existente) menos el cronómetro en el sitio.
  // No es un dato nuevo del backend, solo una resta sobre lo que ya tenemos.
  const remainingLabel = (() => {
    if (operationalPhase !== 'arrived' || !job.duration_hours) return null;
    const remainingSec = Math.round(job.duration_hours * 3600) - elapsedSec;
    if (remainingSec <= 0) return null;
    const m = Math.round(remainingSec / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}min` : `${m} min`;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={PALETTE.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={styles.headerLabel}>Trabajo Activo</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{job.title}</Text>
        </View>
        <View style={styles.headerIconBox}>
          <Ionicons name={getCategoryIconName(job.category)} size={20} color={PALETTE.blue} />
        </View>
      </View>

      {/* ── Confirmación inmediata al avanzar de fase ── */}
      {phaseConfirmed != null && (
        <View style={styles.confirmBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.confirmBannerTitle}>
              {phaseConfirmed === 'en_route' ? '🚗 ¡En camino al lugar!' : '📍 ¡Llegaste al lugar!'}
            </Text>
            <Text style={styles.confirmBannerSub}>Confirmado · Notificando al cliente...</Text>
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg, paddingBottom: (primaryAction || !isCompleted) ? 110 : 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Mapa hero: ubicación del cliente + acceso directo a la ruta ── */}
        {!isCompleted && hasCoords && (
          <View style={styles.mapHeroWrap}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: job.location.lat,
                longitude: job.location.lng,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <ChambaMapMarker
                coordinate={{ latitude: job.location.lat, longitude: job.location.lng }}
                title={clientName}
                categorySlug={job.category}
              />
            </MapView>
            <TouchableOpacity style={styles.mapHeroBtn} activeOpacity={0.85} onPress={handleOpenMap}>
              <Ionicons name="navigate" size={15} color={PALETTE.blue} />
              <Text style={styles.mapHeroBtnText}>Ver ruta</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Tarjeta hero: estado actual + cronómetro en el sitio ── */}
        {!isCompleted && (
          <View style={styles.card}>
            <View style={styles.heroTitleRow}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {banner?.title ?? 'Trabajando en el servicio'}
              </Text>
              {phaseBadge && (
                <View style={[styles.phaseBadge, { backgroundColor: phaseBadge.bg }]}>
                  <Text style={[styles.phaseBadgeText, { color: phaseBadge.fg }]}>{phaseBadge.label}</Text>
                </View>
              )}
            </View>
            {!!banner?.sub && <Text style={styles.heroSub}>{banner.sub}</Text>}

            {operationalPhase === 'arrived' && (
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Tiempo transcurrido</Text>
                  <Text style={styles.statValue}>{formatElapsed(elapsedSec)}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Hora de llegada</Text>
                  <Text style={styles.statValue}>{formatTime(job.updated_at)}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Chamba asegurada</Text>
                  <Text style={[styles.statValue, { color: PALETTE.green }]}>Protegida</Text>
                </View>
              </View>
            )}

            {operationalPhase === 'arrived' && (
              <View style={styles.tipBanner}>
                <Ionicons name="shield-checkmark" size={18} color={PALETTE.green} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>Recordá brindar un excelente servicio</Text>
                  <Text style={styles.tipSub}>Tu calificación es muy importante</Text>
                </View>
                {remainingLabel && (
                  <View style={styles.remainingChip}>
                    <Text style={styles.remainingChipLabel}>RESTANTE</Text>
                    <Text style={styles.remainingChipValue}>{remainingLabel}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Servicio activo ── */}
        <View style={styles.card}>
          <View style={styles.serviceRow}>
            <View style={styles.serviceIconBox}>
              <Ionicons name={getCategoryIconName(job.category)} size={26} color={PALETTE.blue} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.serviceCategory}>{getCategoryLabel(job.category).toUpperCase()}</Text>
              <Text style={styles.serviceTitle} numberOfLines={2}>{job.title}</Text>
              {!!job.location?.address && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={13} color={PALETTE.textSecondary} />
                  <Text style={styles.metaText} numberOfLines={1}>{job.location.address}</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.payoutLabel}>TU GANANCIA</Text>
          <Text style={styles.payoutBig}>{formatCurrency(job.worker_payout)}</Text>

          <View style={styles.divider} />

          <View style={styles.clientRow}>
            <Avatar uri={job.creator?.avatar_url ?? null} name={clientName} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.clientLabel}>CLIENTE</Text>
              <Text style={styles.clientName} numberOfLines={1}>{clientName}</Text>
            </View>
          </View>
        </View>

        {/* ── Estado del servicio ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado del servicio</Text>
          <View style={{ marginTop: 14 }}>
            <ConnectedStepper phase={operationalPhase} />
          </View>
        </View>

        {/* ── Acciones rápidas ── */}
        {!isCompleted && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Acciones rápidas</Text>
            <View style={styles.quickActionsRow}>
              <QuickActionButton
                icon="chatbubble-ellipses-outline"
                label="Chat con cliente"
                disabled={!canChatNow}
                onPress={() => void handleOpenChat(false)}
              />
              <QuickActionButton
                icon="call-outline"
                label="Llamar al cliente"
                onPress={handleCallClient}
              />
              <QuickActionButton
                icon="camera-outline"
                label="Enviar foto"
                disabled={!canUploadPhotos}
                onPress={handleQuickPhoto}
              />
              <QuickActionButton
                icon="alert-circle-outline"
                label="Reportar problema"
                onPress={handleReportProblem}
              />
            </View>
          </View>
        )}

        {/* ── ¿Necesitás más tiempo? ── */}
        {!isCompleted && (operationalPhase === 'en_route' || operationalPhase === 'arrived') && (
          <View style={styles.moreTimeBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.moreTimeTitle}>¿Necesitás más tiempo?</Text>
              <Text style={styles.moreTimeSub}>Solicitá tiempo adicional al cliente por chat.</Text>
            </View>
            <TouchableOpacity style={styles.moreTimeBtn} activeOpacity={0.85} onPress={handleRequestMoreTime}>
              <Text style={styles.moreTimeBtnText}>Solicitar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Chat histórico (servicio completado) ── */}
        {isCompleted && showJobChatEntry(job.status) && (
          <JobChatEntryButton
            variant="worker"
            fullWidth
            readOnly
            onPress={() => void handleOpenChat(true)}
          />
        )}

        {/* ── Calificar al cliente (servicio completado) ── */}
        {isCompleted && job.created_by && workerId && (
          <Card>
            <WorkerRatingPrompt
              workerId={job.created_by}
              workerName="tu cliente"
              reviewerId={workerId}
              reviewerRole="worker"
              reviewerName={profile?.full_name ?? 'Técnico'}
              subjectRole="client"
              title="Calificá a tu cliente"
            />
          </Card>
        )}

        {canUploadPhotos && workerId && (
          <View onLayout={(e) => { photoSectionY.current = e.nativeEvent.layout.y; }}>
            <Card>
              <JobBeforeAfterUpload job={job} workerId={workerId} />
            </Card>
          </View>
        )}

        {/* ── Detalles del servicio ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detalles del servicio</Text>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={PALETTE.textSecondary} />
            <Text style={styles.detailLabel}>Hora programada</Text>
            <Text style={styles.detailValue}>{scheduledLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color={PALETTE.textSecondary} />
            <Text style={styles.detailLabel}>Precio acordado</Text>
            <Text style={styles.detailValue}>{formatCurrency(job.pay_amount)}</Text>
          </View>
          {!!job.description && (
            <View style={{ marginTop: 4 }}>
              <View style={styles.detailRow}>
                <Ionicons name="document-text-outline" size={16} color={PALETTE.textSecondary} />
                <Text style={styles.detailLabel}>Notas del cliente</Text>
              </View>
              <Text style={styles.detailNotes}>{job.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Barra inferior: Cancelar (vía soporte) + acción principal dinámica ──
          El despacho de la acción principal es el mismo que ya vivía en
          JobOperationalStepper — solo se movió la presentación acá. Cancelar
          no tiene RPC propio para el técnico, así que reutiliza el mismo canal
          de soporte por WhatsApp que ya usa ClientActiveServiceCard. */}
      {!isCompleted && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.8}
            onPress={handleCancelViaSupport}
          >
            <Ionicons name="close-circle-outline" size={18} color={PALETTE.red} />
            <Text style={styles.cancelBtnText}>Cancelar servicio</Text>
          </TouchableOpacity>

          {primaryAction && (
            <TouchableOpacity
              style={[styles.primaryActionBtn, (isAdvancing || isCompleting) && { opacity: 0.7 }]}
              activeOpacity={0.85}
              disabled={isAdvancing || isCompleting}
              onPress={handlePrimaryAction}
            >
              {(isAdvancing || isCompleting) ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name={primaryAction.icon} size={20} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>{primaryAction.label}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Confetti / Success Overlay ── */}
      {showSuccess && (
        <SuccessOverlay payout={job.worker_payout} onDismiss={handleDismissSuccess} />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1, backgroundColor: PALETTE.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
    gap: SPACING.sm,
    backgroundColor: PALETTE.bg,
  },
  headerLabel: {
    color: PALETTE.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  headerTitle: {
    color: PALETTE.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: PALETTE.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: PALETTE.green,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  confirmBannerTitle: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  confirmBannerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },

  /* --- Tarjetas genéricas (mismo lenguaje visual que ClientActiveServiceCard) --- */
  card: {
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    padding: 20,
    ...CARD_SHADOW,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.text,
  },
  divider: {
    height: 1,
    backgroundColor: PALETTE.border,
    marginVertical: 14,
  },

  /* --- Servicio activo --- */
  serviceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  serviceIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: PALETTE.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.blue,
    letterSpacing: 0.4,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: PALETTE.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    color: PALETTE.textSecondary,
    flexShrink: 1,
  },
  payoutLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.textSecondary,
    letterSpacing: 0.5,
    marginTop: 16,
  },
  payoutBig: {
    fontSize: 28,
    fontWeight: '700',
    color: PALETTE.green,
    marginTop: 2,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.textSecondary,
    letterSpacing: 0.4,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.text,
    marginTop: 1,
  },

  /* --- Mapa hero --- */
  mapHeroWrap: {
    height: 210,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  mapHeroBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...CARD_SHADOW,
  },
  mapHeroBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.blue,
  },

  /* --- Tarjeta hero de estado --- */
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: PALETTE.text,
  },
  heroSub: {
    fontSize: 13,
    color: PALETTE.textSecondary,
    marginTop: 4,
  },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  phaseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
  },
  statBox: {
    flex: 1,
    gap: 3,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: PALETTE.border,
    marginHorizontal: 16,
  },
  statLabel: {
    fontSize: 12,
    color: PALETTE.textSecondary,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: PALETTE.text,
  },
  tipBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: PALETTE.greenSoft,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.text,
    lineHeight: 19,
  },
  tipSub: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    marginTop: 2,
  },
  remainingChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  remainingChipLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: PALETTE.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  remainingChipValue: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.blue,
    marginTop: 1,
  },

  /* --- Acciones rápidas --- */
  quickActionsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  quickActionWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  quickActionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PALETTE.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionCircleDisabled: {
    backgroundColor: '#F3F4F6',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: PALETTE.text,
    textAlign: 'center',
  },
  quickActionLabelDisabled: {
    color: '#9CA3AF',
  },

  /* --- ¿Necesitás más tiempo? --- */
  moreTimeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PALETTE.blueSoft,
    borderRadius: 18,
    padding: 16,
  },
  moreTimeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.text,
  },
  moreTimeSub: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    marginTop: 2,
  },
  moreTimeBtn: {
    backgroundColor: PALETTE.blue,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  moreTimeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* --- Detalles --- */
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  detailLabel: {
    flex: 1,
    fontSize: 13,
    color: PALETTE.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.text,
  },
  detailNotes: {
    fontSize: 13,
    color: PALETTE.text,
    lineHeight: 19,
    marginTop: 4,
    marginLeft: 24,
  },

  /* --- Barra inferior fija --- */
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: PALETTE.bg,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
    padding: SPACING.lg,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: PALETTE.red,
    borderRadius: 16,
    paddingVertical: 15,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.red,
  },
  primaryActionBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 15,
    backgroundColor: PALETTE.green,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },

  /* --- Overlay de éxito (sin cambios) --- */
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
    borderRadius: 999,
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
