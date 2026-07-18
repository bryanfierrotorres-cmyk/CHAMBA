import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { CHAMBA } from '@constants/chambaUI';
import { fetchAppConfig, updateAppConfigValue, type AppConfigRow } from '../services/configService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CONFIG_QUERY_KEY = ['admin', 'app-config'];

/**
 * Configuración operativa (app_config) — sin tocar código. RLS ya restringe la
 * escritura a admin (migración 073_allocation_fallback.sql); esta pantalla es
 * solo la UI sobre una tabla y unos permisos que ya existían.
 */
export const ConfigurationModal: React.FC<Props> = ({ visible, onClose }) => {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AppConfigRow[]>({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: fetchAppConfig,
    enabled: visible,
    staleTime: 15_000,
    retry: 0,
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => updateAppConfigValue(key, value),
    onMutate: ({ key }) => setSavingKey(key),
    onSettled: () => {
      setSavingKey(null);
      void queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
    },
    onError: (err: Error) => {
      const msg = `No se pudo guardar: ${err.message}`;
      if (Platform.OS === 'web') window.alert(msg);
    },
  });

  const rows = data ?? [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configuración</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            Parámetros operativos de CHAMBA. Los cambios aplican de inmediato, sin desplegar código.
          </Text>

          {isLoading ? <ActivityIndicator color={CHAMBA.blue} style={{ marginTop: 24 }} /> : null}
          {error ? <Text style={styles.errorText}>{error.message}</Text> : null}

          {rows.map((row: AppConfigRow) => {
            const draft = drafts[row.key] ?? row.value;
            const dirty = draft !== row.value;
            const saving = savingKey === row.key;
            return (
              <View key={row.key} style={styles.card}>
                <Text style={styles.keyLabel}>{row.key}</Text>
                {row.description ? <Text style={styles.descLabel}>{row.description}</Text> : null}
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={(v) => setDrafts((prev) => ({ ...prev, [row.key]: v }))}
                    editable={!saving}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
                    onPress={() => save.mutate({ key: row.key, value: draft })}
                    disabled={!dirty || saving}
                  >
                    {saving
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Text style={styles.saveBtnText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {!isLoading && rows.length === 0 && !error ? (
            <Text style={styles.hint}>No hay parámetros configurados todavía.</Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  scroll: { padding: 20, gap: 14 },
  hint: { fontSize: 13, color: '#64748B', lineHeight: 19 },
  errorText: { fontSize: 13, color: '#DC2626' },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  keyLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  descLabel: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  editRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 84,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#CBD5E1' },
  saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
