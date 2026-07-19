import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@utils/formatters';
import { INICIO, CARD_RADIUS, INNER_RADIUS } from './inicioTheme';

interface WeeklyProgressProps {
  weekCompleted: number;
  weekEarned: number;
  jobsGoal: number;
  earnGoal: number;
}

export const WeeklyProgress: React.FC<WeeklyProgressProps> = ({
  weekCompleted,
  weekEarned,
  jobsGoal,
  earnGoal,
}) => {
  const pct = Math.min(1, jobsGoal > 0 ? weekCompleted / jobsGoal : 0);
  const almost = pct >= 0.6;

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={styles.trophy}>
          <Ionicons name="trophy" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.leftCol}>
          <Text style={styles.title}>Tu progreso semanal</Text>
          <Text style={styles.subtitle}>{`${weekCompleted} de ${jobsGoal} trabajos completados`}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%` }]} />
          </View>
          <Text style={styles.hint}>{almost ? 'Falta poco para tu meta 💪' : 'Sumá chambas esta semana 💪'}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.metaLabel}>Meta semanal</Text>
        <Text style={styles.metaValue}>{formatCurrency(earnGoal).replace(/\.00$/, '')}</Text>
        <Text style={styles.metaEarned}>{`Llevas ${formatCurrency(weekEarned).replace(/\.00$/, '')}`}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: INICIO.indigoSurface,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: INICIO.indigoSoft,
    padding: 16,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  trophy: {
    width: 48,
    height: 48,
    borderRadius: INNER_RADIUS,
    backgroundColor: INICIO.blue,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  leftCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', color: INICIO.textStrong, marginBottom: 2 },
  subtitle: { fontSize: 12, color: INICIO.textMedium, marginBottom: 6 },
  track: { width: '100%', height: 8, borderRadius: 999, backgroundColor: INICIO.indigoBorder, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999, backgroundColor: INICIO.blue },
  hint: { fontSize: 10, color: INICIO.textMedium, marginTop: 5 },
  right: {
    alignItems: 'flex-end',
    borderLeftWidth: 1,
    borderLeftColor: INICIO.indigoBorder,
    paddingLeft: 14,
    flexShrink: 0,
  },
  metaLabel: { fontSize: 12, color: INICIO.textMedium, marginBottom: 2 },
  metaValue: { fontSize: 18, fontWeight: '800', color: INICIO.textStrong },
  metaEarned: { fontSize: 10, fontWeight: '600', color: INICIO.greenText, marginTop: 2 },
});
