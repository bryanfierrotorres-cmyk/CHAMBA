import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '@components/Badge';
import { CHAMBA } from '@constants/chambaUI';
import { formatCurrency, formatRelativeTime, getCategoryLabel } from '@utils/formatters';
import type { AdminJob } from '../../services/adminService';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  jobs: AdminJob[];
  emptyMessage: string;
  onSelectJob: (jobId: string) => void;
  /** Etiqueta extra por fila (ej. "Aceptado en 12 min") — opcional. */
  getExtraLabel?: (job: AdminJob) => string | null;
}

/**
 * Modal genérico: convierte un número de tarjeta ("18 Pendientes") en la lista
 * accionable detrás de ese número. Reusa los mismos `jobs` ya cargados por el
 * Dashboard — el llamador decide el filtro, este componente solo renderiza.
 */
export const JobListModal: React.FC<Props> = ({
  visible, onClose, title, subtitle, jobs, emptyMessage, onSelectJob, getExtraLabel,
}) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
        renderItem={({ item }) => {
          const extra = getExtraLabel?.(item);
          const clientName = item.creator?.full_name?.trim() || 'Cliente';
          const workerName = item.assignments?.[0]?.worker?.full_name;
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.85}
              onPress={() => { onClose(); onSelectJob(item.id); }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {getCategoryLabel(item.category)} · {formatRelativeTime(item.created_at)}
                </Text>
                <Text style={styles.rowClient} numberOfLines={1}>
                  Cliente: {clientName}{workerName ? ` · Técnico: ${workerName}` : ''}
                </Text>
                {extra ? <Text style={styles.rowExtra}>{extra}</Text> : null}
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowAmount}>{formatCurrency(item.pay_amount)}</Text>
                <StatusBadge status={item.status} size="sm" />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  </Modal>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  headerSubtitle: { fontSize: 12, color: '#64748B', marginTop: 1 },
  list: { padding: 20, gap: 10, flexGrow: 1 },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rowClient: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rowExtra: { fontSize: 12, color: CHAMBA.blue, fontWeight: '600', marginTop: 4 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowAmount: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
});
