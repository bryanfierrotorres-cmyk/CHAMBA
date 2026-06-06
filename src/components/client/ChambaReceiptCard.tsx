import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  buildReceiptInvoiceNumber,
  type ReceiptData,
} from '@features/client/utils/receiptTypes';

const DEEP_BLUE = '#1E293B';
const TEXT = '#111827';
const MUTED = '#6B7280';
const BORDER = '#D1D5DB';

interface ChambaReceiptCardProps {
  data: ReceiptData;
}

/** Recibo minimalista (referencia inDrive): solo texto, sin iconos. */
export const ChambaReceiptCard = forwardRef<View, ChambaReceiptCardProps>(
  ({ data }, ref) => {
    const invoice = buildReceiptInvoiceNumber(data.jobId);
    const client = data.clientName?.trim() || 'Cliente';
    const worker = data.workerName?.trim() || '—';
    const address = data.address?.trim() || '—';
    const dateLabel = data.completedDateLabel ?? data.completedAt;
    const duration =
      data.durationHours != null && data.durationHours > 0
        ? `${data.durationHours} h`
        : null;

    return (
      <View ref={ref} collapsable={false} style={styles.sheet}>
        <Text style={styles.brand}>CHAMBA</Text>
        <Text style={styles.headline}>Recibo de tu servicio</Text>
        <Text style={styles.invoice}>Comprobante: {invoice}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLeft}>Para: {client}</Text>
          <Text style={styles.metaRight}>Fecha: {dateLabel}</Text>
        </View>

        <View style={styles.details}>
          <ReceiptLine label="Tipo de servicio" value={data.categoryLabel} />
          <ReceiptLine label="Servicio" value={data.jobTitle} />
          <ReceiptLine label="Técnico" value={worker} />
          <ReceiptLine label="Ubicación" value={address} />
          <ReceiptLine label="Fecha del servicio" value={data.completedAt} />
          {duration ? (
            <ReceiptLine label="Duración" value={duration} />
          ) : null}
        </View>

        <View style={styles.tableTopRule} />
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderText}>Descripción</Text>
          <Text style={[styles.tableHeaderText, styles.tableRight]}>Monto</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Servicio CHAMBA</Text>
          <Text style={[styles.tableCell, styles.tableCellBold, styles.tableRight]}>
            {data.payAmountLabel}
          </Text>
        </View>
        <View style={styles.tableBottomRule} />

        <View style={styles.footerRow}>
          <Text style={styles.payment}>Forma de pago: Efectivo al técnico</Text>
          <Text style={styles.total}>
            Total: {data.payAmountLabel}
          </Text>
        </View>
      </View>
    );
  },
);

ChambaReceiptCard.displayName = 'ChambaReceiptCard';

const ReceiptLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Text style={styles.detailLine}>
    <Text style={styles.detailLabel}>{label}: </Text>
    {value}
  </Text>
);

const styles = StyleSheet.create({
  sheet: {
    width: 360,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    color: DEEP_BLUE,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 10,
  },
  headline: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
    textAlign: 'center',
    marginBottom: 6,
  },
  invoice: {
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 22,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  metaLeft: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
  metaRight: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
    textAlign: 'right',
  },
  details: {
    gap: 6,
    marginBottom: 20,
  },
  detailLine: {
    fontSize: 13,
    color: TEXT,
    lineHeight: 20,
  },
  detailLabel: {
    fontWeight: '700',
    color: TEXT,
  },
  tableTopRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    paddingBottom: 12,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: TEXT,
    lineHeight: 20,
  },
  tableCellBold: {
    fontWeight: '700',
  },
  tableRight: {
    textAlign: 'right',
    flex: 0,
    minWidth: 88,
  },
  tableBottomRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginBottom: 14,
  },
  footerRow: {
    gap: 10,
  },
  payment: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
  total: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'right',
  },
});
