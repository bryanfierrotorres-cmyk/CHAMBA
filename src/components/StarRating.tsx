import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@constants/theme';
import { CHAMBA } from '@constants/chambaUI';
import { coerceNumber } from '@utils/formatters';

const STAR_GOLD = '#F59E0B';
const STAR_EMPTY = '#D1D5DB';

interface StarRatingProps {
  rating?:       number | null;
  totalReviews?: number;
  size?:         'sm' | 'md' | 'lg';
  showCount?:    boolean;
  interactive?:  boolean;
  value?:        number;
  onChange?:     (rating: number) => void;
}

const SIZE_MAP = { sm: 16, md: 20, lg: 28 } as const;

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  totalReviews,
  size = 'md',
  showCount = true,
  interactive = false,
  value = 0,
  onChange,
}) => {
  const starSize = SIZE_MAP[size];
  const displayRating = interactive
    ? coerceNumber(value, 0)
    : rating != null
      ? coerceNumber(rating, NaN)
      : NaN;
  const hasRating = interactive
    ? displayRating > 0
    : Number.isFinite(displayRating) && displayRating > 0;

  const renderStar = (index: number) => {
    const score = interactive ? coerceNumber(value, 0) : displayRating;
    const filled = interactive
      ? index < score
      : index < Math.floor(score) ||
        (index === Math.floor(score) && score - Math.floor(score) >= 0.4);

    const iconName = filled ? 'star' : 'star-outline';

    if (interactive) {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => onChange?.(index + 1)}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          activeOpacity={0.75}
        >
          <Ionicons name={iconName} size={starSize + 2} color={filled ? STAR_GOLD : STAR_EMPTY} />
        </TouchableOpacity>
      );
    }

    return (
      <Ionicons key={index} name={iconName} size={starSize} color={filled ? STAR_GOLD : STAR_EMPTY} />
    );
  };

  if (!interactive && !hasRating) {
    return (
      <View style={styles.row}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Ionicons key={i} name="star-outline" size={starSize} color={STAR_EMPTY} />
        ))}
        <Text style={[styles.noRating, { fontSize: starSize * 0.75 }]}>Sin calificación</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {Array.from({ length: 5 }).map((_, i) => renderStar(i))}

      {!interactive && hasRating && (
        <>
          <Text style={[styles.score, { fontSize: starSize * 0.85 }]}>
            {displayRating.toFixed(1)}
          </Text>
          {showCount && totalReviews != null && (
            <Text style={[styles.count, { fontSize: starSize * 0.75 }]}>
              ({totalReviews})
            </Text>
          )}
        </>
      )}

      {interactive && value > 0 && (
        <Text style={[styles.score, { fontSize: starSize * 0.85, marginLeft: SPACING.sm }]}>
          {value}/5
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flexWrap: 'wrap',
  },
  score: {
    color: CHAMBA.navy,
    fontWeight: '700',
    marginLeft: SPACING.xs,
  },
  count: {
    color: CHAMBA.muted,
    marginLeft: 2,
  },
  noRating: {
    color: CHAMBA.muted,
    marginLeft: SPACING.xs,
  },
});
