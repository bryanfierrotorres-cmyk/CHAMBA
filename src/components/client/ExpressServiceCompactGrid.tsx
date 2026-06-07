import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { ServiceCard } from '@components/client/ServiceCard';
import type { ImageSourcePropType } from 'react-native';

const GAP = 12;
const H_PAD = 20;
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - H_PAD * 2 - GAP) / 2;

export interface ExpressCompactItem {
  id: string;
  title: string;
  iconColor: string;
  icon: React.ReactNode;
  onPress: () => void;
  footer: string;
  isCategory?: boolean;
  imageSource?: ImageSourcePropType | null;
  imageSize?: number;
}

interface ExpressServiceCompactGridProps {
  items: ExpressCompactItem[];
}

/** Grilla 2 columnas con tarjetas ServiceCard (3D + claymorphism). */
export const ExpressServiceCompactGrid: React.FC<ExpressServiceCompactGridProps> = ({
  items,
}) => (
  <View style={styles.grid}>
    {items.map((item) => (
      <ServiceCard
        key={item.id}
        style={styles.cardSlot}
        title={item.title}
        footer={item.footer}
        onPress={item.onPress}
        imageSource={item.imageSource}
        imageSize={item.imageSize}
        icon={item.icon}
        iconColor={item.iconColor}
        isCategory={item.isCategory}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    marginBottom: 12,
    width: '100%',
  },
  cardSlot: {
    width: CARD_W,
  },
});
