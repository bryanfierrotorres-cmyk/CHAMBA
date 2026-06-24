import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';
import { CHAT_THEME } from '@features/chat/constants/chatTheme';
import { coerceNumber, formatCurrency, getCategoryLabel } from '@utils/formatters';
import { formatNicaPhoneDisplay } from '@utils/phoneNicaragua';
import {
  OPERATIONAL_STEPS,
  resolveOperationalPhase,
  getStepVisualState,
} from '@utils/workerOperationalPhase';
import type { AssignedWorkerSummary, ClientOrderJob } from '@/types';

const resolveAssignedWorker = (
  raw: AssignedWorkerSummary | AssignedWorkerSummary[] | null | undefined,
): AssignedWorkerSummary | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
};

// Custom date formatter to match "12 Oct 2023, 14:30"
const formatCardDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleDateString('es-ES', { month: 'short' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  // capitalize first letter of month
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${day} ${monthCap} ${year}, ${time}`;
};

interface Props {
  job: ClientOrderJob;
  clientId?: string;
  pendingApplicationsCount?: number;
  onOpenChat?: (jobId: string, readOnly: boolean) => void;
  onPressCompleted?: (jobId: string) => void;
  onExpiredChange?: (expired: boolean) => void;
}

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

export const ClientActiveServiceCard: React.FC<Props> = ({
  job,
  onOpenChat,
  onPressCompleted,
}) => {
  const worker = resolveAssignedWorker(job.assigned_worker);
  const title = job.title?.trim() || getCategoryLabel(job.category) || 'Servicio';
  const categoryLabel = getCategoryLabel(job.category).toUpperCase();
  const payAmount = coerceNumber(job.pay_amount, 0);
  const isVariablePrice = job.status === 'open' && payAmount <= 0;
  const isCompleted = job.status === 'completed';
  const isCancelled = job.status === 'cancelled' || job.status === 'cancelled_by_client_pending';
  const showWorkerHero = !!worker && !isCancelled && job.status !== 'open';
  const canChat = !!worker && !!onOpenChat && !isCancelled;
  const createdLabel = formatCardDate(job.created_at);

  const phase = resolveOperationalPhase(job);

  // Determinar el índice actual para colorear la línea conectora
  const currentRank = phase ? OPERATIONAL_STEPS.findIndex((s) => s.phase === phase) : -1;

  // Iconos por fase (personalizados según el diseño)
  const getPhaseIcon = (phaseKey: string, isActiveOrDone: boolean) => {
    const color = isActiveOrDone ? '#FFF' : '#A0AEC0'; // blanco si está activo, gris claro si no
    switch (phaseKey) {
      case 'accepted': return <Ionicons name="checkmark" size={16} color={color} />;
      case 'en_route': return <Ionicons name="bus" size={16} color={color} />; // camioneta/bus
      case 'arrived': return <Ionicons name="location-outline" size={16} color={color} />;
      case 'completed': return <Ionicons name="checkmark-done" size={16} color={color} />;
      default: return <Ionicons name="ellipse" size={16} color={color} />;
    }
  };

  const cardBody = (
    <>
      {/* ── A. Bloque Superior ── */}
      <View style={styles.topBlock}>
        <View style={styles.rowBetween}>
          <Text style={styles.categoryLabel}>{categoryLabel}</Text>
          <Text style={isVariablePrice ? styles.priceVariable : styles.priceText}>
            {isVariablePrice ? 'Bajo cotización' : formatCurrency(payAmount)}
          </Text>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.titleText} numberOfLines={2}>{title}</Text>
          <View style={styles.paymentBadge}>
            <Text style={styles.paymentBadgeText}>Pago Pendiente</Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color="#4A5568" />
          <Text style={styles.dateText}>{createdLabel}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── B. Línea de Tiempo de Estado ── */}
      <View style={styles.timelineBlock}>
        {OPERATIONAL_STEPS.map((step, index) => {
          const state = getStepVisualState(step.phase, phase);
          const isDoneOrActive = state === 'done' || state === 'active';
          const connectorFilled = currentRank > index;
          const isLast = index === OPERATIONAL_STEPS.length - 1;

          return (
            <React.Fragment key={step.phase}>
              <View style={styles.timelineStep}>
                <View style={[styles.timelineIconWrapper, isDoneOrActive && styles.timelineIconWrapperActive]}>
                  <View style={[styles.timelineIconCircle, isDoneOrActive && styles.timelineIconCircleActive]}>
                    {getPhaseIcon(step.phase, isDoneOrActive)}
                  </View>
                </View>
                <Text style={[styles.timelineStepLabel, isDoneOrActive && styles.timelineStepLabelActive]}>
                  {step.label}
                </Text>
              </View>
              {!isLast && (
                <View style={[styles.timelineConnector, connectorFilled && styles.timelineConnectorFilled]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* ── C y D. Bloque del Técnico y Acciones ── */}
      {showWorkerHero && worker && (
        <>
          <View style={styles.divider} />
          
          <View style={styles.workerBlock}>
            <View style={styles.workerRow}>
              <View>
                <Avatar uri={worker.avatar_url} name={worker.full_name} size={48} />
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                </View>
              </View>
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{worker.full_name}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star-outline" size={14} color="#4A5568" />
                  {/* Calificación mock por diseño. Si tienes data real: formatRatingAvg(worker.rating) */}
                  <Text style={styles.ratingText}>4.9 (124)</Text>
                </View>
              </View>
            </View>

            {!isCompleted && (
              <View style={styles.actionsRow}>
                {canChat && (
                  <TouchableOpacity
                    style={styles.btnChat}
                    onPress={() => onOpenChat!(job.id, false)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color="#2D3748" />
                    <Text style={styles.btnChatText}>Chat</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.btnCall}
                  onPress={() => callWorker(worker.phone)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={18} color="#FFF" />
                  <Text style={styles.btnCallText}>Llamar</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {isCompleted && canChat && (
               <TouchableOpacity
                 style={styles.btnChat}
                 onPress={() => onOpenChat!(job.id, true)}
                 activeOpacity={0.8}
               >
                 <Ionicons name="chatbubble-outline" size={18} color="#2D3748" />
                 <Text style={styles.btnChatText}>Ver Chat Histórico</Text>
               </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {isCancelled && (
         <View style={styles.cancelledBlock}>
           <Text style={styles.cancelledText}>Servicio cancelado</Text>
         </View>
      )}
    </>
  );

  if (isCompleted && onPressCompleted) {
    return (
      <TouchableOpacity
        style={styles.cardContainer}
        activeOpacity={0.88}
        onPress={() => onPressCompleted(job.id)}
      >
        {cardBody}
      </TouchableOpacity>
    );
  }

  return <View style={styles.cardContainer}>{cardBody}</View>;
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    ...CARD_STEP_SHADOW,
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginVertical: 16,
  },
  /* --- Bloque A: Superior --- */
  topBlock: {
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: CHAMBA.teal,
    letterSpacing: 0.5,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A202C',
    flex: 1,
    marginRight: 10,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: CHAMBA.teal,
  },
  priceVariable: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
  },
  paymentBadge: {
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4A5568',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#4A5568',
    fontWeight: '400',
  },

  /* --- Bloque B: Línea de Tiempo --- */
  timelineBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  timelineStep: {
    alignItems: 'center',
    width: 60,
  },
  timelineIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconWrapperActive: {
    backgroundColor: '#E6FFFA', // Fondo muy suave teal
  },
  timelineIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconCircleActive: {
    backgroundColor: CHAMBA.teal,
  },
  timelineStepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A0AEC0',
    marginTop: 8,
    textAlign: 'center',
  },
  timelineStepLabelActive: {
    color: CHAMBA.teal,
    fontWeight: '700',
  },
  timelineConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginTop: 22,
    marginHorizontal: -10,
    zIndex: -1,
  },
  timelineConnectorFilled: {
    backgroundColor: CHAMBA.teal,
  },

  /* --- Bloque C & D: Técnico y Botones --- */
  workerBlock: {
    gap: 16,
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
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 13,
    color: '#4A5568',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btnChat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
  },
  btnChatText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3748',
  },
  btnCall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CHAMBA.teal,
    borderRadius: 14,
    paddingVertical: 12,
  },
  btnCallText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelledBlock: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelledText: {
    color: '#E53E3E',
    fontWeight: '600',
    fontSize: 14,
  },
});
