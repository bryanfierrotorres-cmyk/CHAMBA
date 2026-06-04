import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';

const GAP = 10;
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
}

interface ExpressServiceCompactGridProps {
  items: ExpressCompactItem[];
}

/**
 * Grilla 2 columnas — tipografía alineada con Servicios Premium (chambaUI).
 */
export const ExpressServiceCompactGrid: React.FC<ExpressServiceCompactGridProps> = ({
  items,
}) => (
  <View style={styles.grid}>
    {items.map((item) => (
      <ChambaPressable
        key={item.id}
        style={styles.card}
        onPress={item.onPress}
      >
        <View style={[styles.iconWrap, { backgroundColor: item.iconColor }]}>
          {item.icon}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.isCategory ? (
          <View style={chambaStyles.demandBadge}>
            <Text style={chambaStyles.demandBadgeText}>{item.footer}</Text>
          </View>
        ) : (
          <Text style={[chambaStyles.priceLine, styles.priceCenter]} numberOfLines={1}>
            {item.footer}
          </Text>
        )}
      </ChambaPressable>
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
  card: {
    width: CARD_W,
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    minHeight: 112,
    justifyContent: 'flex-start',
    ...CARD_STEP_SHADOW,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    ...chambaStyles.cardTitle,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    minHeight: 38,
    width: '100%',
    letterSpacing: -0.3,
  },
  priceCenter: {
    textAlign: 'center',
    marginTop: 6,
  },
});
