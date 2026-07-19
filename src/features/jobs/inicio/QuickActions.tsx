import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INICIO, CARD_RADIUS, INICIO_CARD_SHADOW } from './inicioTheme';

export type QuickActionKey = 'radar' | 'agenda' | 'wallet' | 'stats' | 'profile';

interface QuickActionsProps {
  onAction: (key: QuickActionKey) => void;
}

const ACTIONS: {
  key: QuickActionKey;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
}[] = [
  { key: 'radar', icon: 'radio', color: INICIO.blueIcon, label: 'Radar de\ntrabajo' },
  { key: 'agenda', icon: 'calendar', color: INICIO.green, label: 'Mi Agenda' },
  { key: 'wallet', icon: 'wallet', color: INICIO.purple, label: 'Billetera' },
  { key: 'stats', icon: 'stats-chart', color: INICIO.amber, label: 'Mis\nestadísticas' },
  { key: 'profile', icon: 'person', color: INICIO.blueIcon, label: 'Mi Perfil' },
];

export const QuickActions: React.FC<QuickActionsProps> = ({ onAction }) => (
  <View>
    <View style={styles.header}>
      <Text style={styles.sectionTitle}>Acciones rápidas</Text>
      <Pressable style={styles.linkRow} onPress={() => onAction('radar')} accessibilityRole="button">
        <Text style={styles.link}>Ver todas</Text>
        <Ionicons name="chevron-forward" size={10} color={INICIO.blue} />
      </Pressable>
    </View>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {ACTIONS.map((a) => (
        <Pressable key={a.key} style={styles.item} onPress={() => onAction(a.key)} accessibilityRole="button">
          <View style={styles.iconBox}>
            <Ionicons name={a.icon} size={22} color={a.color} />
          </View>
          <Text style={styles.itemLabel} numberOfLines={2}>{a.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: INICIO.textStrong },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  link: { fontSize: 12, fontWeight: '600', color: INICIO.blue },
  scroll: { gap: 16, paddingBottom: 4 },
  item: { alignItems: 'center', gap: 8, minWidth: 66 },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: CARD_RADIUS,
    backgroundColor: INICIO.card,
    borderWidth: 1,
    borderColor: INICIO.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...INICIO_CARD_SHADOW,
  },
  itemLabel: { fontSize: 12, fontWeight: '500', color: '#374151', textAlign: 'center', lineHeight: 15 },
});
