import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ServiceCard } from '@components/client/ServiceCard';
import type { ImageSourcePropType } from 'react-native';

const GAP_H = 12;
const GAP_V = 16;
const H_PAD = 16;
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - H_PAD * 2 - GAP_H) / 2;

export interface ExpressCompactItem {
  id: string;
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  footer: string;
  isCategory?: boolean;
  photoSource?: ImageSourcePropType | null;
  availableBadge?: string;
}

interface ExpressServiceCompactGridProps {
  items: ExpressCompactItem[];
}

/** Grilla 2 columnas — tarjetas premium con foto real (spec Home v1.0). */
export const ExpressServiceCompactGrid: React.FC<ExpressServiceCompactGridProps> = ({
  items,
}) => (
  <View style={styles.grid}>
    {items.map((item) => (
      <ServiceCard
        key={item.id}
        style={styles.cardSlot}
        title={item.title}
        description={item.description}
        footer={item.footer}
        onPress={item.onPress}
        photoSource={item.photoSource}
        icon={item.icon}
        isCategory={item.isCategory}
        availableBadge={item.availableBadge}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GAP_H,
    rowGap: GAP_V,
    marginBottom: 12,
    width: '100%',
  },
  cardSlot: {
    width: CARD_W,
  },
});
