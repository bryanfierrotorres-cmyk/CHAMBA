import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { CARD_STEP_SHADOW } from '@constants/chambaUI';

type SkeletonVariant = 'grid' | 'request';

interface Props {
  variant: SkeletonVariant;
}

const { width: SCREEN_W } = Dimensions.get('window');
const GAP = 12;
const H_PAD = 20;
// Same exact width as ServiceCard grid layout
const CARD_W = (SCREEN_W - H_PAD * 2 - GAP) / 2;

export const SkeletonCard: React.FC<Props> = ({ variant }) => {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacityAnim]);

  if (variant === 'grid') {
    return (
      <Animated.View style={[styles.gridCard, { opacity: opacityAnim }]}>
        <View style={styles.gridImagePlaceholder} />
        <View style={styles.gridTextPlaceholder1} />
        <View style={styles.gridTextPlaceholder2} />
      </Animated.View>
    );
  }

  // variant === 'request'
  return (
    <Animated.View style={[styles.requestCard, { opacity: opacityAnim }]}>
      {/* Bloque Superior */}
      <View style={styles.reqTop}>
        <View style={styles.reqRowBetween}>
          <View style={styles.reqCategory} />
          <View style={styles.reqPrice} />
        </View>
        <View style={[styles.reqRowBetween, { marginTop: 8 }]}>
          <View style={styles.reqTitle} />
          <View style={styles.reqBadge} />
        </View>
        <View style={styles.reqDate} />
      </View>

      <View style={styles.divider} />

      {/* Línea de tiempo */}
      <View style={styles.reqTimeline}>
        <View style={styles.reqTimelineNode} />
        <View style={styles.reqTimelineLine} />
        <View style={styles.reqTimelineNode} />
        <View style={styles.reqTimelineLine} />
        <View style={styles.reqTimelineNode} />
        <View style={styles.reqTimelineLine} />
        <View style={styles.reqTimelineNode} />
      </View>

      <View style={styles.divider} />

      {/* Bloque Técnico */}
      <View style={styles.reqWorkerRow}>
        <View style={styles.reqAvatar} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.reqWorkerName} />
          <View style={styles.reqWorkerRating} />
        </View>
      </View>

      {/* Botones */}
      <View style={styles.reqButtonsRow}>
        <View style={styles.reqButton} />
        <View style={styles.reqButton} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // --- Grid Variant ---
  gridCard: {
    width: CARD_W,
    minHeight: 196,
    backgroundColor: '#F1F5F9', // bg-slate-100
    borderRadius: 22,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...CARD_STEP_SHADOW,
  },
  gridImagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E2E8F0', // bg-slate-200
    marginTop: 10,
  },
  gridTextPlaceholder1: {
    width: '80%',
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginTop: 'auto',
    marginBottom: 8,
  },
  gridTextPlaceholder2: {
    width: '50%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },

  // --- Request Variant ---
  requestCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    ...CARD_STEP_SHADOW,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  reqTop: { gap: 8 },
  reqRowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reqCategory: { width: 80, height: 14, borderRadius: 7, backgroundColor: '#E2E8F0' },
  reqPrice: { width: 90, height: 18, borderRadius: 9, backgroundColor: '#E2E8F0' },
  reqTitle: { width: 150, height: 20, borderRadius: 10, backgroundColor: '#E2E8F0' },
  reqBadge: { width: 100, height: 22, borderRadius: 11, backgroundColor: '#E2E8F0' },
  reqDate: { width: 120, height: 14, borderRadius: 7, backgroundColor: '#E2E8F0', marginTop: 4 },
  
  reqTimeline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  reqTimelineNode: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2E8F0' },
  reqTimelineLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: -5 },

  reqWorkerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  reqAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E2E8F0' },
  reqWorkerName: { width: 140, height: 16, borderRadius: 8, backgroundColor: '#E2E8F0' },
  reqWorkerRating: { width: 80, height: 14, borderRadius: 7, backgroundColor: '#E2E8F0' },

  reqButtonsRow: { flexDirection: 'row', gap: 12 },
  reqButton: { flex: 1, height: 48, borderRadius: 14, backgroundColor: '#E2E8F0' },
});
