import React from 'react';
import { memo } from 'react';
const _keepReact = React;
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { ReviewCard } from '../static/ReviewCard';
import { SkeletonCard } from '@components/SkeletonCard';
import { COLORS, FONT_SIZE, SPACING } from '@constants/theme';
import type { WorkerReview } from '@/types';

interface ReviewsListProps {
  reviews: WorkerReview[];
  isLoading: boolean;
  ListHeaderComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
}

const EmptyState = memo(() => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>
      Nuevo en CHAMBA. Este profesional aún no tiene reseñas. ¡Sé el primero en contratarlo!
    </Text>
  </View>
));

export const ReviewsList: React.FC<ReviewsListProps> = ({ reviews, isLoading, ListHeaderComponent, ListFooterComponent }) => {
  if (isLoading) {
    return (
      <View style={styles.skeletonContainer}>
        {ListHeaderComponent}
        <SkeletonCard variant="request" />
        <SkeletonCard variant="request" />
        {ListFooterComponent}
      </View>
    );
  }

  return (
    <FlatList
      data={reviews}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ReviewCard review={item} />
      )}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={<EmptyState />}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={5}
      removeClippedSubviews={true}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: SPACING.sm,
    flexGrow: 1,
  },
  skeletonContainer: {
    paddingVertical: SPACING.sm,
  },
  emptyContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg.elevated,
    borderRadius: 12,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
