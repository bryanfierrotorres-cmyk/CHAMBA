import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatRatingAvg } from '@utils/formatters';
import { INICIO, CARD_RADIUS, INICIO_CARD_SHADOW } from './inicioTheme';

interface KpiGridProps {
  earningsToday: number;
  earningsYesterday: number;
  solicitudesHoy: number;
  solicitudesNuevas: number;
  ratingAvg: number | null;
  radiusKm: number;
  onPressRadius: () => void;
}

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <View style={styles.starsRow}>
    {[1, 2, 3, 4, 5].map((i) => {
      const name = rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-outline';
      return <Ionicons key={i} name={name} size={12} color={INICIO.amber} />;
    })}
  </View>
);

const KpiCard: React.FC<{
  iconBg: string;
  iconColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  width: number;
  children: React.ReactNode;
}> = ({ iconBg, iconColor, icon, value, label, width, children }) => (
  <View style={[styles.card, { width }]}>
    <View style={styles.topRow}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={15} color={iconColor} />
      </View>
      <Text style={styles.value} numberOfLines={1}>{value}</Text>
    </View>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

export const KpiGrid: React.FC<KpiGridProps> = ({
  earningsToday,
  earningsYesterday,
  solicitudesHoy,
  solicitudesNuevas,
  ratingAvg,
  radiusKm,
  onPressRadius,
}) => {
  const { width: screenW } = useWindowDimensions();
  const cardW = (Math.min(screenW, 520) - 32 - 12) / 2;

  const deltaPct = earningsYesterday > 0
    ? Math.round(((earningsToday - earningsYesterday) / earningsYesterday) * 100)
    : null;
  const up = (deltaPct ?? 0) >= 0;

  return (
    <View style={styles.grid}>
      <KpiCard
        width={cardW}
        icon="cash"
        iconBg={INICIO.greenSoft}
        iconColor={INICIO.greenText}
        value={formatCurrency(earningsToday).replace(/\.00$/, '')}
        label="Ganancias hoy"
      >
        {deltaPct != null ? (
          <View style={styles.subRow}>
            <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={10} color={up ? INICIO.greenText : INICIO.red} />
            <Text style={[styles.subGreen, !up && styles.subRed]}>{`${Math.abs(deltaPct)}% vs ayer`}</Text>
          </View>
        ) : (
          <Text style={styles.subMuted}>Primer día activo</Text>
        )}
      </KpiCard>

      <KpiCard
        width={cardW}
        icon="briefcase"
        iconBg={INICIO.blueSoft}
        iconColor={INICIO.blue}
        value={String(solicitudesHoy)}
        label="Solicitudes hoy"
      >
        <Text style={styles.subBlue}>
          {solicitudesNuevas > 0 ? `${solicitudesNuevas} nuevas` : 'Sin nuevas'}
        </Text>
      </KpiCard>

      <KpiCard
        width={cardW}
        icon="star"
        iconBg={INICIO.amberSoft}
        iconColor={INICIO.amber}
        value={ratingAvg && ratingAvg > 0 ? formatRatingAvg(ratingAvg) : '—'}
        label="Calificación"
      >
        <Stars rating={ratingAvg ?? 0} />
      </KpiCard>

      <KpiCard
        width={cardW}
        icon="locate"
        iconBg={INICIO.purpleSoft}
        iconColor={INICIO.purple}
        value={`${radiusKm} km`}
        label="Radio activo"
      >
        <Pressable style={styles.subRow} onPress={onPressRadius} accessibilityRole="button">
          <Text style={styles.subBlue}>Cambiar</Text>
          <Ionicons name="chevron-forward" size={10} color={INICIO.blue} />
        </Pressable>
      </KpiCard>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 12 },
  card: {
    backgroundColor: INICIO.card,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: INICIO.border,
    padding: 12,
    ...INICIO_CARD_SHADOW,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 18, fontWeight: '800', color: INICIO.textStrong, letterSpacing: -0.3, flexShrink: 1 },
  label: { fontSize: 12, color: INICIO.textMedium, marginBottom: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  subGreen: { fontSize: 12, fontWeight: '600', color: INICIO.greenText },
  subRed: { color: INICIO.red },
  subBlue: { fontSize: 12, fontWeight: '600', color: INICIO.blue },
  subMuted: { fontSize: 12, color: INICIO.textFaint },
  starsRow: { flexDirection: 'row', gap: 1 },
});
