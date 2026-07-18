import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import MapView from '@components/maps/ChambaMap';
import { ChambaMapMarker } from '@components/maps/ChambaMapMarker';
import { ConnectedStepper } from '@components/shared/ConnectedStepper';
import { ACTIVE_SERVICE_PALETTE as PALETTE, ACTIVE_SERVICE_CARD_SHADOW as CARD_SHADOW } from '@constants/activeServiceTheme';
import {
  coerceNumber,
  formatCurrency,
  formatRelativeTime,
  getCategoryIconName,
  getCategoryLabel,
} from '@utils/formatters';
import { openJobLocationInMaps } from '@utils/openMaps';
import { openWhatsAppSupport } from '@utils/whatsappSupport';
import {
  resolveOperationalPhase,
  getClientPhaseMessage,
} from '@utils/workerOperationalPhase';
import type { AssignedWorkerSummary, ClientOrderJob, JobStatus, WorkerOperationalPhase } from '@/types';

const resolveAssignedWorker = (
  raw: AssignedWorkerSummary | AssignedWorkerSummary[] | null | undefined,
): AssignedWorkerSummary | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
};

const formatCardDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleDateString('es-ES', { month: 'short' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${day} ${monthCap} ${year}, ${time}`;
};

/** Texto + color del badge de estado, según la fase operativa real del job. */
const resolvePhaseBadge = (phase: WorkerOperationalPhase | null): { label: string; bg: string; fg: string } => {
  switch (phase) {
    case 'accepted':
      return { label: 'TÉCNICO ASIGNADO', bg: PALETTE.blueSoft, fg: PALETTE.blue };
    case 'en_route':
      return { label: 'EN CAMINO', bg: PALETTE.blueSoft, fg: PALETTE.blue };
    case 'arrived':
      return { label: 'EN PROCESO', bg: PALETTE.orangeSoft, fg: PALETTE.orange };
    case 'completed':
      return { label: 'FINALIZADO', bg: PALETTE.greenSoft, fg: PALETTE.green };
    default:
      return { label: 'PENDIENTE', bg: '#F3F4F6', fg: PALETTE.textSecondary };
  }
};

/** Mismo mensaje contextual que ya usa el toast de estado del cliente — no se
 * inventa copy nuevo. 'accepted' no tiene caso en esa función compartida, se
 * cubre acá sin tocar el archivo original. */
const resolveBannerMessage = (phase: WorkerOperationalPhase | null): { title: string; body: string } | null => {
  if (phase === 'accepted') {
    return { title: 'Técnico asignado', body: 'Tu técnico fue asignado y pronto iniciará el viaje.' };
  }
  if (phase === 'en_route' || phase === 'arrived' || phase === 'completed') {
    return getClientPhaseMessage(phase);
  }
  return null;
};

const callWorker = (phone: string | null | undefined) => {
  const digits = (phone ?? '').replace(/\D/g, '').slice(-8);
  if (digits.length !== 8) {
    Alert.alert('Sin número', 'El técnico no tiene teléfono registrado.');
    return;
  }
  Linking.openURL(`tel:+505${digits}`).catch(() =>
    Alert.alert('Error', 'No se pudo abrir el marcador.'),
  );
};

interface Props {
  job: ClientOrderJob;
  clientId?: string;
  pendingApplicationsCount?: number;
  onOpenChat?: (jobId: string, readOnly: boolean) => void;
  onPressCompleted?: (jobId: string) => void;
  onExpiredChange?: (expired: boolean) => void;
  onCancel?: () => void;
  canceling?: boolean;
}

/** Botón circular (Chat / Llamar) — un solo lugar para el estilo, evita duplicar. */
const CircleActionButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  variant: 'outline' | 'filled';
  onPress: () => void;
}> = ({ icon, label, variant, onPress }) => (
  <TouchableOpacity style={styles.circleActionWrap} onPress={onPress} activeOpacity={0.8}>
    <View
      style={[
        styles.circleActionButton,
        variant === 'filled' ? styles.circleActionButtonFilled : styles.circleActionButtonOutline,
      ]}
    >
      <Ionicons name={icon} size={20} color={variant === 'filled' ? '#FFFFFF' : PALETTE.blue} />
    </View>
    <Text style={styles.circleActionLabel}>{label}</Text>
  </TouchableOpacity>
);

export const ClientActiveServiceCard: React.FC<Props> = React.memo(({
  job,
  onOpenChat,
  onPressCompleted,
  onCancel,
  canceling,
}) => {
  const worker = resolveAssignedWorker(job.assigned_worker);
  const title = job.title?.trim() || getCategoryLabel(job.category) || 'Servicio';
  const categoryLabel = getCategoryLabel(job.category);
  const payAmount = coerceNumber(job.pay_amount, 0);
  const isVariablePrice = ['open', 'pending_bidding', 'counter_offered'].includes(job.status) && payAmount <= 0;
  const isCompleted = job.status === 'completed';
  const isCancelled = job.status === 'cancelled' || job.status === ('cancelled_by_client_pending' as JobStatus);
  const showWorkerHero = !!worker && !isCancelled && job.status !== 'open';
  const canChat = !!worker && !!onOpenChat && !isCancelled;
  const createdLabel = formatCardDate(job.created_at);
  const canSelfCancel = ['open', 'pending_bidding', 'counter_offered'].includes(job.status) && !isCancelled && !!onCancel;

  const phase = resolveOperationalPhase(job);
  const badge = resolvePhaseBadge(phase);
  const banner = showWorkerHero && !isCompleted ? resolveBannerMessage(phase) : null;
  const hasCoords = !!job.location?.lat && !!job.location?.lng;
  const showMap = showWorkerHero && !isCompleted && hasCoords;

  const requestSupportCancel = () => {
    void openWhatsAppSupport(`Hola, quiero cancelar mi servicio "${title}".`);
  };

  const cardBody = (
    <>
      {/* ── Tarjeta 1: información del servicio ── */}
      <View style={styles.serviceRow}>
        <View style={styles.serviceIconBox}>
          <Ionicons name={getCategoryIconName(job.category)} size={26} color={PALETTE.blue} />
        </View>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceCategory}>{categoryLabel.toUpperCase()}</Text>
          <Text style={styles.serviceTitle} numberOfLines={2}>{title}</Text>
          {!!job.location?.address && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={PALETTE.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>{job.location.address}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={PALETTE.textSecondary} />
            <Text style={styles.metaText}>{createdLabel}</Text>
          </View>
        </View>
        <Text style={isVariablePrice ? styles.priceVariable : styles.priceText}>
          {isVariablePrice ? 'A cotizar' : formatCurrency(payAmount)}
        </Text>
      </View>

      <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.statusBadgeText, { color: badge.fg }]}>{badge.label}</Text>
      </View>

      {/* ── Tarjeta del técnico ── */}
      {showWorkerHero && worker && (
        <View style={styles.workerBlock}>
          <View style={styles.workerRow}>
            <View>
              <Avatar uri={worker.avatar_url} name={worker.full_name} size={56} />
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={PALETTE.green} />
              </View>
            </View>
            <View style={styles.workerInfo}>
              <Text style={styles.workerName}>{worker.full_name}</Text>
              <Text style={styles.workerSpecialty}>{categoryLabel}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color={PALETTE.orange} />
                {/* Calificación mock por diseño — sin datos reales conectados aún */}
                <Text style={styles.ratingText}>4.9</Text>
              </View>
            </View>
            {!isCompleted && (
              <View style={styles.circleActionsRow}>
                {canChat && (
                  <CircleActionButton
                    icon="chatbubble-outline"
                    label="Chat"
                    variant="outline"
                    onPress={() => onOpenChat!(job.id, false)}
                  />
                )}
                <CircleActionButton
                  icon="call-outline"
                  label="Llamar"
                  variant="filled"
                  onPress={() => callWorker(worker.phone)}
                />
              </View>
            )}
          </View>

          {isCompleted && canChat && (
            <TouchableOpacity
              style={styles.btnHistoryChat}
              onPress={() => onOpenChat!(job.id, true)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={18} color={PALETTE.text} />
              <Text style={styles.btnHistoryChatText}>Ver Chat Histórico</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Estado del servicio: stepper conectado ── */}
      {showWorkerHero && (
        <View style={styles.statusCard}>
          <Text style={styles.statusCardTitle}>Estado del servicio</Text>
          <ConnectedStepper phase={phase} />

          {/* ── Banner informativo de la fase actual ── */}
          {banner && (
            <View style={styles.infoBanner}>
              <View style={styles.infoBannerIcon}>
                <Ionicons name="information-circle" size={20} color={PALETTE.blue} />
              </View>
              <View style={styles.infoBannerTextWrap}>
                <Text style={styles.infoBannerTitle}>{banner.body}</Text>
                <Text style={styles.infoBannerSub}>Actualizado {formatRelativeTime(job.updated_at)}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Mapa: ubicación real del servicio (sin GPS en vivo del técnico —
          esa data no llega hoy al cliente, no se simula) ── */}
      {showMap && (
        <View style={styles.mapCard}>
          <Text style={styles.mapCardTitle}>Ubicación del servicio</Text>
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: job.location!.lat,
                longitude: job.location!.lng,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <ChambaMapMarker
                coordinate={{ latitude: job.location!.lat, longitude: job.location!.lng }}
                title={title}
                categorySlug={job.category}
              />
            </MapView>
          </View>
          <TouchableOpacity
            style={styles.mapLinkBtn}
            activeOpacity={0.8}
            onPress={() => void openJobLocationInMaps({
              lat: job.location!.lat,
              lng: job.location!.lng,
              address: job.location?.address,
            })}
          >
            <Ionicons name="map-outline" size={16} color={PALETTE.blue} />
            <Text style={styles.mapLinkText}>Ver mapa completo</Text>
          </TouchableOpacity>
        </View>
      )}

      {isCompleted && onPressCompleted && (
        <TouchableOpacity
          style={styles.btnRate}
          activeOpacity={0.85}
          onPress={() => onPressCompleted(job.id)}
        >
          <Ionicons name="star" size={18} color="#FFFFFF" />
          <Text style={styles.btnRateText}>Calificar al técnico</Text>
        </TouchableOpacity>
      )}

      {isCancelled && (
        <View style={styles.cancelledBlock}>
          <Text style={styles.cancelledText}>Servicio cancelado</Text>
        </View>
      )}

      {/* ── Botones finales: cancelar (si aplica) + contactar soporte ── */}
      {showWorkerHero && !isCompleted && (
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity
            style={styles.btnCancelOutline}
            activeOpacity={0.8}
            disabled={canceling}
            onPress={canSelfCancel ? onCancel : requestSupportCancel}
          >
            {canceling ? (
              <ActivityIndicator color={PALETTE.red} size="small" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color={PALETTE.red} />
                <Text style={styles.btnCancelOutlineText}>Cancelar servicio</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSupportFilled}
            activeOpacity={0.8}
            onPress={() => void openWhatsAppSupport(`Hola, necesito ayuda con mi servicio "${title}".`)}
          >
            <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
            <Text style={styles.btnSupportFilledText}>Contactar soporte</Text>
          </TouchableOpacity>
        </View>
      )}

      {canSelfCancel && !showWorkerHero && (
        <View style={styles.cancelWrap}>
          <TouchableOpacity
            style={styles.btnCancelOutline}
            activeOpacity={0.8}
            disabled={canceling}
            onPress={onCancel}
          >
            {canceling ? (
              <ActivityIndicator color={PALETTE.red} size="small" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color={PALETTE.red} />
                <Text style={styles.btnCancelOutlineText}>Cancelar Solicitud</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  if (isCompleted && onPressCompleted) {
    return (
      <TouchableOpacity
        style={styles.cardContainer}
        activeOpacity={0.92}
        onPress={() => onPressCompleted(job.id)}
      >
        {cardBody}
      </TouchableOpacity>
    );
  }

  return <View style={styles.cardContainer}>{cardBody}</View>;
});

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    padding: 20,
    gap: 16,
    ...CARD_SHADOW,
  },

  /* --- Info del servicio --- */
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
  serviceInfo: {
    flex: 1,
    gap: 3,
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
  priceText: {
    fontSize: 18,
    fontWeight: '600',
    color: PALETTE.text,
  },
  priceVariable: {
    fontSize: 13,
    fontWeight: '500',
    color: PALETTE.textSecondary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  /* --- Técnico --- */
  workerBlock: {
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 1,
  },
  workerInfo: {
    flex: 1,
    gap: 2,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: PALETTE.text,
  },
  workerSpecialty: {
    fontSize: 13,
    color: PALETTE.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 13,
    color: PALETTE.text,
    fontWeight: '600',
  },
  circleActionsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  circleActionWrap: {
    alignItems: 'center',
    gap: 4,
  },
  circleActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  circleActionButtonOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  circleActionButtonFilled: {
    backgroundColor: PALETTE.blue,
  },
  circleActionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: PALETTE.textSecondary,
  },
  btnHistoryChat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 14,
    paddingVertical: 12,
  },
  btnHistoryChatText: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.text,
  },

  /* --- Estado del servicio (stepper) --- */
  statusCard: {
    backgroundColor: PALETTE.bg,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  statusCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.text,
  },
  /* --- Banner informativo --- */
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: PALETTE.blueSoft,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
  },
  infoBannerIcon: {
    marginTop: 1,
  },
  infoBannerTextWrap: {
    flex: 1,
    gap: 2,
  },
  infoBannerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: PALETTE.text,
    lineHeight: 19,
  },
  infoBannerSub: {
    fontSize: 12,
    color: PALETTE.textSecondary,
  },

  /* --- Mapa --- */
  mapCard: {
    gap: 10,
  },
  mapCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.text,
  },
  mapWrap: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  mapLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  mapLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.blue,
  },

  /* --- Estados finales --- */
  cancelledBlock: {
    padding: 12,
    backgroundColor: PALETTE.redSoft,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelledText: {
    color: PALETTE.red,
    fontWeight: '600',
    fontSize: 14,
  },
  cancelWrap: {
    marginTop: 0,
  },
  btnRate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PALETTE.blue,
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnRateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* --- Botones finales --- */
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancelOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: PALETTE.red,
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnCancelOutlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.red,
  },
  btnSupportFilled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PALETTE.blue,
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnSupportFilledText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
