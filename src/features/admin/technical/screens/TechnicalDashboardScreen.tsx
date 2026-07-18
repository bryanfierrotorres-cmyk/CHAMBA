import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '@components/Badge';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import { formatRelativeTime } from '@utils/formatters';
import { diagnoseSystem, type SystemDiagnosis } from '@utils/systemHealth';
import { fetchRecentCrashes, type CrashEvent } from '../services/technicalService';

const STATUS_COLORS: Record<SystemDiagnosis['status'], { color: string; bg: string }> = {
  OK:       { color: '#15803D', bg: '#DCFCE7' },
  DEGRADED: { color: '#B45309', bg: '#FEF3C7' },
  DOWN:     { color: '#B91C1C', bg: '#FEE2E2' },
};

const HEALTH_LABEL: Record<string, string> = {
  ok: 'OK', slow: 'Lento', down: 'Caído', unknown: 'Sin evaluar',
  error: 'Error', timeout: 'Timeout',
};

const DiagnosticRow: React.FC<{ label: string; value: string; latencyMs?: number | null }> = ({
  label, value, latencyMs,
}) => (
  <View style={styles.diagRow}>
    <Text style={styles.diagLabel}>{label}</Text>
    <Text style={styles.diagValue}>
      {value}{latencyMs != null ? ` · ${latencyMs}ms` : ''}
    </Text>
  </View>
);

export const TechnicalDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [diag, setDiag] = useState<SystemDiagnosis | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const [crashes, setCrashes] = useState<CrashEvent[]>([]);
  const [crashesLoading, setCrashesLoading] = useState(false);
  const [crashError, setCrashError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const runDiagnosis = useCallback(async () => {
    setDiagLoading(true);
    try {
      setDiag(await diagnoseSystem());
    } finally {
      setDiagLoading(false);
    }
  }, []);

  const loadCrashes = useCallback(async () => {
    setCrashesLoading(true);
    setCrashError(null);
    try {
      setCrashes(await fetchRecentCrashes());
    } catch (err) {
      setCrashError(err instanceof Error ? err.message : 'No se pudieron cargar los logs');
    } finally {
      setCrashesLoading(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={chambaStyles.screenHeader}>
          <Text style={chambaStyles.screenTitle}>Centro Técnico</Text>
          <Text style={chambaStyles.screenSubtitle}>Solo para desarrollo — no operativo</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[chambaStyles.iconCircleRight, { backgroundColor: '#0EA5E9' }]}>
              <Ionicons name="pulse" size={20} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Estado del sistema</Text>
              <Text style={styles.cardHint}>Internet, Supabase y RPC de login — solo lectura</Text>
            </View>
          </View>

          {diag && (
            <View style={[styles.statusBadgeWrap]}>
              <Badge
                label={diag.status}
                color={STATUS_COLORS[diag.status].color}
                bgColor={STATUS_COLORS[diag.status].bg}
                size="md"
              />
              <Text style={styles.diagReason}>{diag.reason}</Text>
            </View>
          )}

          {diag && (
            <View style={styles.diagList}>
              <DiagnosticRow label="Internet" value={diag.internet ? 'OK' : 'Sin conexión'} />
              <DiagnosticRow
                label="Supabase (REST)"
                value={HEALTH_LABEL[diag.supabase] ?? diag.supabase}
                latencyMs={diag.latencyMs.supabase}
              />
              <DiagnosticRow
                label="RPC (login)"
                value={HEALTH_LABEL[diag.rpc] ?? diag.rpc}
                latencyMs={diag.latencyMs.rpc}
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={runDiagnosis}
            disabled={diagLoading}
            activeOpacity={0.85}
          >
            {diagLoading
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={styles.actionBtnText}>{diag ? 'Volver a diagnosticar' : 'Diagnosticar ahora'}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[chambaStyles.iconCircleRight, { backgroundColor: '#EF4444' }]}>
              <Ionicons name="warning" size={20} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Logs y errores</Text>
              <Text style={styles.cardHint}>Crashes capturados por AppErrorBoundary</Text>
            </View>
          </View>

          {crashError ? <Text style={styles.errorText}>{crashError}</Text> : null}

          {crashes.length === 0 && !crashesLoading ? (
            <Text style={styles.emptyText}>
              Sin registros cargados. Tocá &quot;Cargar logs&quot; para consultar.
            </Text>
          ) : null}

          {crashes.map((c) => {
            const expanded = expandedId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.crashRow}
                onPress={() => setExpandedId(expanded ? null : c.id)}
                activeOpacity={0.85}
              >
                <View style={styles.crashHeader}>
                  <Text style={styles.crashMessage} numberOfLines={expanded ? undefined : 1}>
                    {c.metadata?.error ?? 'Error sin mensaje'}
                  </Text>
                  <Text style={styles.crashTime}>{formatRelativeTime(c.created_at)}</Text>
                </View>
                {expanded && c.metadata?.stack ? (
                  <Text style={styles.crashStack} numberOfLines={12}>{c.metadata.stack}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={loadCrashes}
            disabled={crashesLoading}
            activeOpacity={0.85}
          >
            {crashesLoading
              ? <ActivityIndicator size="small" color={CHAMBA.blue} />
              : <Text style={styles.actionBtnSecondaryText}>Cargar logs</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    gap: 12,
    ...CARD_STEP_SHADOW,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy },
  cardHint: { fontSize: 13, color: CHAMBA.muted, fontWeight: '400', marginTop: 2 },
  statusBadgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diagReason: { fontSize: 13, color: CHAMBA.muted, flex: 1 },
  diagList: { gap: 8 },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
  },
  diagLabel: { fontSize: 13, color: CHAMBA.navy, fontWeight: '600' },
  diagValue: { fontSize: 13, color: CHAMBA.muted },
  actionBtn: {
    backgroundColor: CHAMBA.blue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  actionBtnSecondary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CHAMBA.border,
  },
  actionBtnSecondaryText: { color: CHAMBA.blue, fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 13, color: CHAMBA.muted },
  errorText: { fontSize: 13, color: '#B91C1C' },
  crashRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
    paddingVertical: 10,
    gap: 6,
  },
  crashHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  crashMessage: { flex: 1, fontSize: 13, color: CHAMBA.navy, fontWeight: '600' },
  crashTime: { fontSize: 11, color: CHAMBA.muted },
  crashStack: {
    fontSize: 11,
    color: CHAMBA.muted,
    fontFamily: 'monospace',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
});
