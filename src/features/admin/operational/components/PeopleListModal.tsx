import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { CHAMBA } from '@constants/chambaUI';
import { formatNicaPhoneDisplay, NICA_PHONE_PREFIX } from '@utils/phoneNicaragua';

export interface PersonRow {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  /** Línea extra debajo del teléfono — ej. categoría, "esperando desde hace 2h". */
  meta?: string | null;
  /** Etiqueta de badge, ej. "Disponible", "3 solicitudes pendientes". */
  badge?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  people: PersonRow[];
  emptyMessage: string;
}

/** Modal genérico: convierte un número ("74 Técnicos disponibles") en la lista real detrás. */
export const PeopleListModal: React.FC<Props> = ({
  visible, onClose, title, subtitle, people, emptyMessage,
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
        data={people}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
        renderItem={({ item }) => {
          const phoneDisplay = formatNicaPhoneDisplay(item.phone);
          return (
            <View style={styles.row}>
              <Avatar uri={item.avatar_url} name={item.full_name} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowName} numberOfLines={1}>{item.full_name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {phoneDisplay ? `${NICA_PHONE_PREFIX} ${phoneDisplay}` : '—'}
                  {item.meta ? ` · ${item.meta}` : ''}
                </Text>
              </View>
              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>
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
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  rowName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  badge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: CHAMBA.blue },
});
