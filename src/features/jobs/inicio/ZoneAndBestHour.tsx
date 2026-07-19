import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INICIO, CARD_RADIUS, INNER_RADIUS } from './inicioTheme';

const barColor = (v: number): string => {
  if (v >= 0.9) return INICIO.blueIcon;
  if (v >= 0.65) return '#60A5FA';
  if (v >= 0.4) return INICIO.blueChartMid;
  return INICIO.blueChartLight;
};

const PulseRing: React.FC = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });
  return <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />;
};

export const ZoneActivityCard: React.FC<{
  workersOnline: number;
  requestsLast2h: number;
  recommendedRadiusKm: number;
}> = ({ workersOnline, requestsLast2h, recommendedRadiusKm }) => (
  <View style={styles.zoneCard}>
    <View style={styles.zoneMapArea} pointerEvents="none">
      <View style={styles.mapCircle} />
      <PulseRing />
      <View style={styles.mapPin}>
        <Ionicons name="location" size={16} color={INICIO.blue} />
      </View>
      <View style={[styles.greenDot, { top: '26%', right: '24%' }]} />
      <View style={[styles.greenDot, { bottom: '24%', right: '34%' }]} />
      <View style={[styles.greenDot, { top: '52%', left: '20%' }]} />
    </View>

    <View style={styles.zoneContent}>
      <Text style={styles.zoneTitle}>Actividad en tu zona</Text>
      <Text style={styles.zoneSub}>En las últimas 2 horas</Text>
      <View style={styles.zonePanel}>
        <View style={styles.zoneRow}>
          <Ionicons name="people" size={15} color="#BFDBFE" style={styles.zoneRowIcon} />
          <Text style={styles.zoneRowText}>{`${workersOnline} técnicos conectados`}</Text>
        </View>
        <View style={styles.zoneRow}>
          <Ionicons name="clipboard-outline" size={15} color="#86EFAC" style={styles.zoneRowIcon} />
          <Text style={styles.zoneRowText}>{`${requestsLast2h} solicitudes publicadas`}</Text>
        </View>
        <View style={[styles.zoneRow, { marginBottom: 0 }]}>
          <Ionicons name="locate" size={15} color="#D8B4FE" style={styles.zoneRowIcon} />
          <Text style={styles.zoneRowText}>{`${recommendedRadiusKm} km Radio recomendado`}</Text>
        </View>
      </View>
    </View>
  </View>
);

export const BestHourCard: React.FC<{ label: string; bars: number[] }> = ({ label, bars }) => (
  <View style={styles.bestCard}>
    <View style={styles.bestTitleRow}>
      <Ionicons name="flash" size={15} color={INICIO.teal} />
      <Text style={styles.bestTitle}>Mejor hora hoy</Text>
    </View>
    <Text style={styles.bestWindow}>{label}</Text>
    <Text style={styles.bestDesc}>Es cuando más solicitudes se reciben en tu zona.</Text>

    <View style={styles.chartWrap} pointerEvents="none">
      <View style={styles.chartBars}>
        {bars.map((v, i) => (
          <View
            key={i}
            style={{
              width: 10,
              height: Math.max(6, v * 56),
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3,
              backgroundColor: barColor(v),
            }}
          />
        ))}
      </View>
      <View style={styles.chartLabels}>
        {['8am', '12pm', '4pm', '8pm', '12am'].map((l) => (
          <Text key={l} style={styles.chartLabel}>{l}</Text>
        ))}
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  zoneCard: {
    backgroundColor: INICIO.blue,
    borderRadius: CARD_RADIUS,
    padding: 16,
    minHeight: 160,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  zoneContent: { position: 'relative', zIndex: 2 },
  zoneTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  zoneSub: { fontSize: 12, color: '#BFDBFE', marginTop: 2, marginBottom: 12 },
  zonePanel: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: INNER_RADIUS,
    padding: 12,
    alignSelf: 'flex-start',
  },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  zoneRowIcon: { width: 18, textAlign: 'center' },
  zoneRowText: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' },
  zoneMapArea: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '46%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  mapCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mapPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  greenDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  bestCard: {
    backgroundColor: INICIO.tealSurface,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: INICIO.tealSoft,
    padding: 16,
    overflow: 'hidden',
    minHeight: 150,
  },
  bestTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  bestTitle: { fontSize: 16, fontWeight: '700', color: INICIO.tealText },
  bestWindow: { fontSize: 18, fontWeight: '800', color: INICIO.textStrong, letterSpacing: -0.3 },
  bestDesc: { fontSize: 12, color: INICIO.textMedium, marginTop: 2, maxWidth: '62%' },
  chartWrap: { position: 'absolute', right: 16, bottom: 12, alignItems: 'flex-end' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 56, opacity: 0.85 },
  chartLabels: { flexDirection: 'row', gap: 12, marginTop: 4 },
  chartLabel: { fontSize: 8, color: INICIO.textFaint },
});
