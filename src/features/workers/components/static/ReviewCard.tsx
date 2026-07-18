import React from 'react';
import { memo } from 'react';
const _keepReact = React;
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '@components/Avatar';
import { StarRating } from '@components/StarRating';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/theme';
import { coerceNumber, formatDate } from '@utils/formatters';
import type { WorkerReview, ReviewerRole } from '@/types';

interface ReviewCardProps {
  review: WorkerReview;
}

const ROLE_LABELS: Record<ReviewerRole, string> = {
  admin:  'Administrador',
  client: 'Cliente',
  worker: 'Técnico',
};

const ReviewCardComponent: React.FC<ReviewCardProps> = ({ review }) => {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewHeader}>
        <Avatar
          uri={review.reviewer?.avatar_url}
          name={review.reviewer?.full_name ?? 'Usuario'}
          size={32}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewerName}>
            {review.reviewer?.full_name ?? 'Usuario'}
          </Text>
          <Text style={styles.reviewMeta}>
            {ROLE_LABELS[review.reviewer_role]} · {formatDate(review.created_at)}
          </Text>
        </View>
        <StarRating rating={coerceNumber(review.rating, 0)} showCount={false} size="sm" />
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  reviewRow: {
    backgroundColor: '#FFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border.subtle,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  reviewerName: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  reviewMeta: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },
  reviewComment: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
});

export const ReviewCard = memo(ReviewCardComponent);
