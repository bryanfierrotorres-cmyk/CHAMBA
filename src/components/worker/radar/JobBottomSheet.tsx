import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@components/EmptyState';
import {
  RADAR_BORDER,
  RADAR_DEEP_BLUE,
  RADAR_MUTED,
  RADAR_TITLE,
} from './radarTheme';
import type { Job } from '@/types';

interface JobBottomSheetProps {
  jobs: Job[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  listHeader?: React.ReactNode;
  renderJob: (job: Job) => React.ReactElement | null;
  emptyTitle: string;
  emptySubtitle: string;
}

const SheetHandle: React.FC<{ jobCount: number; peekTitle?: string }> = ({
  jobCount,
  peekTitle,
}) => (
  <View style={styles.handleWrap}>
    <View style={styles.handleIndicator} />
    <Text style={styles.handleTitle}>
      {jobCount === 0
        ? 'Sin solicitudes disponibles'
        : `${jobCount} solicitud${jobCount === 1 ? '' : 'es'} disponible${jobCount === 1 ? '' : 's'}`}
    </Text>
    {peekTitle ? (
      <Text style={styles.handlePeek} numberOfLines={1}>
        {peekTitle}
      </Text>
    ) : null}
  </View>
);

const NativeJobBottomSheet: React.FC<JobBottomSheetProps> = ({
  jobs,
  isLoading,
  isFetchingNextPage,
  onRefresh,
  onEndReached,
  listHeader,
  renderJob,
  emptyTitle,
  emptySubtitle,
}) => {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['22%', '62%'], []);
  const peekTitle = jobs[0]?.title?.trim();

  const renderItem = useCallback(
    ({ item }: { item: Job }) => renderJob(item),
    [renderJob],
  );

  const ListHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        {listHeader}
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={RADAR_DEEP_BLUE} />
          </View>
        ) : null}
      </View>
    ),
    [listHeader, isLoading],
  );

  const ListEmpty = useMemo(
    () => (
      !isLoading ? (
        <EmptyState
          icon="briefcase-outline"
          title={emptyTitle}
          subtitle={emptySubtitle}
          actionLabel="Actualizar"
          onAction={onRefresh}
        />
      ) : null
    ),
    [isLoading, emptyTitle, emptySubtitle, onRefresh],
  );

  const ListFooter = useMemo(
    () => (
      isFetchingNextPage
        ? <ActivityIndicator color={RADAR_DEEP_BLUE} style={{ marginVertical: 16 }} />
        : <View style={{ height: insets.bottom + 12 }} />
    ),
    [isFetchingNextPage, insets.bottom],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      handleComponent={() => (
        <SheetHandle jobCount={jobs.length} peekTitle={peekTitle} />
      )}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.hiddenIndicator}
    >
      <BottomSheetFlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={RADAR_DEEP_BLUE} />
        }
      />
    </BottomSheet>
  );
};

const WebJobBottomSheet: React.FC<JobBottomSheetProps> = (props) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const panelHeight = expanded ? height * 0.62 : Math.min(140, height * 0.22);
  const peekTitle = props.jobs[0]?.title?.trim();

  return (
    <View style={[styles.webSheet, { height: panelHeight + insets.bottom }]}>
      <Pressable
        style={styles.webHandle}
        onPress={() => setExpanded((v) => !v)}
      >
        <SheetHandle jobCount={props.jobs.length} peekTitle={peekTitle} />
      </Pressable>
      {expanded ? (
        <FlatList
          data={props.jobs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => props.renderJob(item)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={(
            <View style={styles.listHeader}>
              {props.listHeader}
              {props.isLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={RADAR_DEEP_BLUE} />
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            !props.isLoading ? (
              <EmptyState
                icon="briefcase-outline"
                title={props.emptyTitle}
                subtitle={props.emptySubtitle}
                actionLabel="Actualizar"
                onAction={props.onRefresh}
              />
            ) : null
          }
          ListFooterComponent={
            props.isFetchingNextPage
              ? <ActivityIndicator color={RADAR_DEEP_BLUE} style={{ marginVertical: 16 }} />
              : <View style={{ height: insets.bottom }} />
          }
          onEndReached={props.onEndReached}
          onEndReachedThreshold={0.35}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={props.onRefresh}
              tintColor={RADAR_DEEP_BLUE}
            />
          }
        />
      ) : null}
    </View>
  );
};

export const JobBottomSheet: React.FC<JobBottomSheetProps> = (props) => {
  if (Platform.OS === 'web') {
    return <WebJobBottomSheet {...props} />;
  }
  return <NativeJobBottomSheet {...props} />;
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  hiddenIndicator: {
    height: 0,
    opacity: 0,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RADAR_BORDER,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 10,
  },
  handleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: RADAR_TITLE,
    textAlign: 'center',
  },
  handlePeek: {
    fontSize: 12,
    fontWeight: '500',
    color: RADAR_MUTED,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: '100%',
  },
  listHeader: {
    gap: 12,
    paddingBottom: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  webSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    overflow: 'hidden',
    zIndex: 20,
  },
  webHandle: {
    width: '100%',
  },
});
