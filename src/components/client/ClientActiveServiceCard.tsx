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
import { ClientServiceStatusTracker } from '@components/client/ClientServiceStatusTracker';
import { JobChatEntryButton } from '@components/chat/JobChatEntryButton';
import { showJobChatEntry } from '@features/chat/utils/chatHelpers';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';
import { CHAT_THEME } from '@features/chat/constants/chatTheme';
import { coerceNumber, formatCurrency, formatDate, getCategoryLabel } from '@utils/formatters';
import { formatNicaPhoneDisplay } from '@utils/phoneNicaragua';
import { getCategoryVisual } from '@utils/categoryVisual';
import type { AssignedWorkerSummary, ClientOrderJob } from '@/types';

const resolveAssignedWorker = (
  raw: AssignedWorkerSummary | AssignedWorkerSummary[] | null | undefined,
): AssignedWorkerSummary | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
};

interface Props {
  job: ClientOrderJob;
  pendingApplicationsCount?: number;
  onOpenChat?: (jobId: string, readOnly: boolean) => void;
  onPressCompleted?: (jobId: string) => void;
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
  pendingApplicationsCount = 0,
  onOpenChat,
  onPressCompleted,
}) => {
  const worker = resolveAssignedWorker(job.assigned_worker);
  const visual = getCategoryVisual(job.category);
  const title = job.title?.trim() || getCategoryLabel(job.category) || 'Servicio';
  const payAmount = coerceNumber(job.pay_amount, 0);
  const isVariablePrice = job.status === 'open' && payAmount <= 0;
  const isCompleted = job.status === 'completed';
  const isCancelled = job.status === 'cancelled';
  const showWorkerHero = !!worker && !isCancelled && job.status !== 'open';
  const canChat = !!worker && !!onOpenChat && showJobChatEntry(job.status) && !isCancelled;
  const createdLabel = job.created_at ? formatDate(job.created_at) : '—';

  const cardBody = (
    <>
      <View style={styles.summaryRow}>
        <View style={[styles.serviceIcon, { backgroundColor: visual.color }]}>
          {visual.icon}
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.serviceTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.serviceMeta}>{createdLabel}</Text>
          <Text style={isVariablePrice ? styles.priceVariable : styles.price}>
            {isVariablePrice ? 'Bajo cotización' : formatCurrency(payAmount)}
          </Text>
        </View>
        {isCompleted && (
          <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
        )}
      </View>

      <View style={styles.trackerSection}>
        <ClientServiceStatusTracker
          job={job}
          pendingApplicationsCount={pendingApplicationsCount}
        />
      </View>

      {showWorkerHero && worker && (
        <View style={styles.techSection}>
          <Text style={styles.techSectionLabel}>QUIÉN TE ATIENDE</Text>
          <View style={styles.techRow}>
            <Avatar uri={worker.avatar_url} name={worker.full_name} size={56} />
            <View style={styles.techInfo}>
              <Text style={styles.techName}>{worker.full_name}</Text>
              <Text style={styles.techRole}>Técnico verificado CHAMBA</Text>
              {worker.phone ? (
                <Text style={styles.techPhone}>
                  {formatNicaPhoneDisplay(worker.phone)}
                </Text>
              ) : null}
            </View>
          </View>

          {!isCompleted && (
            <View style={styles.contactRow}>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => callWorker(worker.phone)}
                activeOpacity={0.88}
              >
                <Ionicons name="call" size={18} color="#FFF" />
                <Text style={styles.callBtnText}>Llamar</Text>
              </TouchableOpacity>
              {canChat && (
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => onOpenChat!(job.id, false)}
                  activeOpacity={0.88}
                >
                  <Ionicons name="chatbubbles" size={18} color={CHAT_THEME.clientAccent} />
                  <Text style={styles.chatBtnText}>Chat</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {isCompleted && canChat && (
            <JobChatEntryButton
              variant="client"
              readOnly
              fullWidth
              onPress={() => onOpenChat!(job.id, true)}
            />
          )}
        </View>
      )}

      {isCompleted && (
        <Text style={styles.completedHint}>Toca para ver resumen completo y fotos</Text>
      )}
    </>
  );

  if (isCompleted && onPressCompleted) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() => onPressCompleted(job.id)}
      >
        {cardBody}
      </TouchableOpacity>
    );
  }

  return <View style={styles.card}>{cardBody}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    gap: 16,
    ...CARD_STEP_SHADOW,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: { flex: 1, minWidth: 0 },
  serviceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: CHAMBA.navy,
    letterSpacing: -0.2,
  },
  serviceMeta: {
    fontSize: 13,
    color: CHAMBA.muted,
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: CHAMBA.teal,
    marginTop: 4,
  },
  priceVariable: {
    fontSize: 14,
    fontWeight: '500',
    color: CHAMBA.muted,
    marginTop: 4,
  },
  trackerSection: {},
  techSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
    paddingTop: 14,
    gap: 12,
  },
  techSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: CHAMBA.muted,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  techInfo: { flex: 1, minWidth: 0 },
  techName: {
    fontSize: 17,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  techRole: {
    fontSize: 13,
    color: CHAMBA.muted,
    marginTop: 2,
  },
  techPhone: {
    fontSize: 13,
    color: CHAMBA.blue,
    fontWeight: '600',
    marginTop: 4,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CHAMBA.teal,
    borderRadius: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  callBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: `${CHAT_THEME.clientAccent}44`,
    minHeight: 48,
  },
  chatBtnText: {
    color: CHAT_THEME.clientAccent,
    fontWeight: '700',
    fontSize: 15,
  },
  completedHint: {
    fontSize: 12,
    color: CHAMBA.muted,
    textAlign: 'center',
    marginTop: -4,
  },
});
