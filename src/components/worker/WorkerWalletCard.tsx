import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CHAMBA, CARD_STEP_SHADOW } from '@constants/chambaUI';
import { formatCurrency } from '@utils/formatters';
import type { WorkerWalletSummary } from '@utils/workerWalletSummary';

interface WorkerWalletCardProps {
  summary: WorkerWalletSummary;
  /** Solo desglose (sin repetir saldo total) — p. ej. pantalla Billetera. */
  breakdownOnly?: boolean;
}

const WalletLine: React.FC<{
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'accent';
}> = ({ label, value, tone = 'default' }) => (
  <View style={styles.lineRow}>
    <Text style={styles.lineLabel}>{label}</Text>
    <Text
      style={[
        styles.lineValue,
        tone === 'muted' && styles.lineValueMuted,
        tone === 'accent' && styles.lineValueAccent,
      ]}
    >
      {value}
    </Text>
  </View>
);

export const WorkerWalletCard: React.FC<WorkerWalletCardProps> = ({
  summary,
  breakdownOnly = false,
}) => {
  const hasBreakdown =
    summary.pendingPayout > 0
    || summary.processingPayout > 0
    || summary.paidOut > 0;

  if (breakdownOnly && !hasBreakdown) {
    return null;
  }

  return (
    <View style={styles.card}>
      {!breakdownOnly && (
        <>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Billetera CHAMBA</Text>
              <Text style={styles.totalLabel}>Saldo disponible</Text>
            </View>
          </View>

          <Text style={styles.totalAmount}>{formatCurrency(summary.totalAvailable)}</Text>
          <Text style={styles.totalHint}>
            {summary.completedCount > 0
              ? `${summary.completedCount} servicio${summary.completedCount === 1 ? '' : 's'} completado${summary.completedCount === 1 ? '' : 's'}`
              : 'Tus ganancias aparecerán aquí al completar chambas'}
          </Text>
        </>
      )}

      {breakdownOnly && hasBreakdown && (
        <Text style={styles.breakdownTitle}>Desglose de saldo</Text>
      )}

      {hasBreakdown && (
        <View style={[styles.breakdown, breakdownOnly && styles.breakdownStandalone]}>
          {summary.paidOut > 0 && (
            <WalletLine
              label="Transferido"
              value={formatCurrency(summary.paidOut)}
            />
          )}
          {summary.pendingPayout > 0 && (
            <WalletLine
              label="Pendiente de acreditar"
              value={formatCurrency(summary.pendingPayout)}
              tone="accent"
            />
          )}
          {summary.processingPayout > 0 && (
            <WalletLine
              label="En proceso de pago"
              value={formatCurrency(summary.processingPayout)}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
    ...CARD_STEP_SHADOW,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: CHAMBA.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: CHAMBA.muted,
    textTransform: 'uppercase',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: CHAMBA.navy,
    marginTop: 2,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: CHAMBA.primary,
    letterSpacing: -0.5,
  },
  totalHint: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 4,
    lineHeight: 17,
  },
  breakdown: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
    gap: 8,
  },
  breakdownStandalone: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CHAMBA.navy,
    marginBottom: 4,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  lineLabel: {
    flex: 1,
    fontSize: 13,
    color: CHAMBA.muted,
    fontWeight: '500',
  },
  lineValue: {
    fontSize: 14,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  lineValueMuted: {
    color: CHAMBA.muted,
    fontWeight: '600',
  },
  lineValueAccent: {
    color: '#0284C7',
  },
});
