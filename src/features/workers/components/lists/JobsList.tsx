import React from 'react';
import { memo } from 'react';
const _keepReact = React;
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { JobCard } from '../static/JobCard';
import { SkeletonCard } from '@components/SkeletonCard';
import { M3, SPACING } from '@constants/stitchStyles';
import type { JobAssignment } from '@/types';

interface JobsListProps {
  jobs: JobAssignment[];
  isLoading: boolean;
  onJobPress?: (job: JobAssignment) => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
}

const EmptyState = memo(() => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>
      Nuevo en CHAMBA. Este profesional aún no tiene historial de trabajos. ¡Anímate a contratarlo!
    </Text>
  </View>
));

export const JobsList: React.FC<JobsListProps> = ({ jobs, isLoading, onJobPress, ListHeaderComponent, ListFooterComponent }) => {
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
      data={jobs}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <JobCard assignment={item} onPress={onJobPress} />
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
    backgroundColor: M3.surfaceVariant,
    borderRadius: 12,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: 15,
    color: M3.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
});
