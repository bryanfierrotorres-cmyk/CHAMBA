import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, getCategoryIconName } from '@utils/formatters';
import { INICIO, CARD_RADIUS, INNER_RADIUS, INICIO_CARD_SHADOW } from './inicioTheme';
import type { RadarInboxJob } from '@features/jobs/services/radarInboxService';

const timeAgo = (iso: string): string => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `Hace ${Math.max(1, mins)} min`;
  const hours = Math.floor(mins / 60);
  return `Hace ${hours} h`;
};

const scheduleLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
  const h = d.getHours();
  const period = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  const prefix = isToday ? 'Hoy' : `${d.getDate()}/${d.getMonth() + 1}`;
  return `${prefix} • ${hour12}:${mm} ${period}`;
};

const barrioLabel = (address: string | undefined, distanceKm: number | null): string => {
  const barrio = address?.split(',')[0]?.trim() || 'Tu zona';
  if (distanceKm == null) return barrio;
  const dist = distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
  return `${barrio} • ${dist}`;
};

interface RequestCardProps {
  job: RadarInboxJob;
  onPressDetail: () => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({ job, onPressDetail }) => {
  const image = job.media_urls?.[0];
  const isNew = Date.now() - new Date(job.created_at).getTime() < 2 * 60 * 60 * 1000;

  return (
    <View style={styles.card}>
      <View style={styles.thumb}>
        {image ? (
          <Image source={{ uri: image }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name={getCategoryIconName(job.category)} size={30} color={INICIO.blue} />
          </View>
        )}
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newText}>NUEVA</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View>
          <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>{barrioLabel(job.location?.address, job.distanceKm)}</Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={11} color={INICIO.textMedium} />
            <Text style={styles.meta}>{scheduleLabel(job.scheduled_at ?? job.created_at)}</Text>
          </View>
        </View>
        <Text style={styles.price}>{formatCurrency(job.pay_amount).replace(/\.00$/, '')}</Text>
      </View>

      <View style={styles.actionCol}>
        <Pressable style={styles.detailBtn} onPress={onPressDetail} accessibilityRole="button">
          <Text style={styles.detailText}>Ver detalles</Text>
        </Pressable>
        <Text style={styles.ago}>{timeAgo(job.created_at)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: INICIO.card,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: INICIO.border,
    padding: 12,
    ...INICIO_CARD_SHADOW,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: INNER_RADIUS,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: { flex: 1, backgroundColor: INICIO.blueSoft, alignItems: 'center', justifyContent: 'center' },
  newBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: INICIO.green,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
  body: { flex: 1, justifyContent: 'space-between', minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', color: INICIO.textStrong },
  meta: { fontSize: 12, color: INICIO.textMedium },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  price: { fontSize: 14, fontWeight: '700', color: INICIO.textStrong, marginTop: 6 },
  actionCol: { justifyContent: 'center', alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  detailBtn: {
    backgroundColor: INICIO.blue,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  ago: { fontSize: 10, color: INICIO.textFaint },
});
