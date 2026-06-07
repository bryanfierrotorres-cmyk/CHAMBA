import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  FlatList,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RADAR_BORDER,
  RADAR_DEEP_BLUE,
  RADAR_MUTED,
  RADAR_TITLE,
} from './radarTheme';
import {
  COMPACT_JOB_CARD_GAP,
  COMPACT_JOB_CARD_HEIGHT,
} from './CompactJobCard';
import type { Job } from '@/types';

/** ~5 filas compactas visibles en el snap inicial del sheet. */
const COMPACT_PEEK_ROWS = 5;
const SHEET_HANDLE_HEIGHT = 56;

const computeCompactPeekRatio = (windowHeight: number): string => {
  const listBlock =
    COMPACT_JOB_CARD_HEIGHT * COMPACT_PEEK_ROWS
    + COMPACT_JOB_CARD_GAP * (COMPACT_PEEK_ROWS - 1)
    + SHEET_HANDLE_HEIGHT
    + 48;
  const ratio = Math.min(0.58, Math.max(0.42, listBlock / windowHeight));
  return `${Math.round(ratio * 100)}%`;
};

interface JobBottomSheetProps {
  jobs: Job[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  listHeader?: React.ReactNode;
  renderJob: (job: Job) => React.ReactElement | null;
  /** Hint opcional bajo el mensaje de búsqueda (ej. filtro activo). */
  emptyHint?: string;
}

const SheetHandle: React.FC<{ jobCount: number; peekTitle?: string }> = ({
  jobCount,
  peekTitle,
}) => (
  <View style={styles.handleWrap}>
    <View style={styles.handleIndicator} />
    {jobCount === 0 ? (
      <Text style={styles.handleTitleCentered}>Solicitudes</Text>
    ) : (
      <>
        <Text style={styles.handleTitle}>
          {`${jobCount} solicitud${jobCount === 1 ? '' : 'es'} disponible${jobCount === 1 ? '' : 's'}`}
        </Text>
        {peekTitle ? (
          <Text style={styles.handlePeek} numberOfLines={1}>
            {peekTitle}
          </Text>
        ) : null}
      </>
    )}
  </View>
);

const NativeJobBottomSheet: React.FC<JobBottomSheetProps> = ({
  jobs,
  isLoading,
  isFetchingNextPage,
  onEndReached,
  listHeader,
  renderJob,
  emptyHint,
}) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(
    () => (
      jobs.length === 0
        ? ['18%', '62%']
        : [computeCompactPeekRatio(windowHeight), '78%']
    ),
    [jobs.length, windowHeight],
  );
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
      !isLoading && emptyHint ? (
        <View style={styles.sheetEmptyHint}>
          <Text style={styles.sheetEmptyHintText}>{emptyHint}</Text>
        </View>
      ) : null
    ),
    [isLoading, emptyHint],
  );

  const ListFooter = useMemo(
    () => (
      isFetchingNextPage
        ? <ActivityIndicator color={RADAR_DEEP_BLUE} style={{ marginVertical: 16 }} />
        : <View style={{ height: insets.bottom + 12 }} />
    ),
    [isFetchingNextPage, insets.bottom],
  );

  const ItemSeparator = useCallback(
    () => <View style={styles.itemSeparator} />,
    [],
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
        ItemSeparatorComponent={ItemSeparator}
        showsVerticalScrollIndicator
        contentContainerStyle={[
          styles.listContent,
          jobs.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
      />
    </BottomSheet>
  );
};

const WebJobBottomSheet: React.FC<JobBottomSheetProps> = (props) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const isEmpty = props.jobs.length === 0;
  const compactPeekHeight =
    COMPACT_JOB_CARD_HEIGHT * COMPACT_PEEK_ROWS
    + COMPACT_JOB_CARD_GAP * (COMPACT_PEEK_ROWS - 1)
    + SHEET_HANDLE_HEIGHT
    + 32;
  const panelHeight = expanded
    ? height * 0.78
    : isEmpty
      ? Math.min(118, height * 0.16)
      : Math.min(compactPeekHeight, height * 0.58);
  const peekTitle = props.jobs[0]?.title?.trim();

  return (
    <View style={[styles.webSheet, { height: panelHeight + insets.bottom }]}>
      <Pressable
        style={styles.webHandle}
        onPress={() => setExpanded((v) => !v)}
      >
        <SheetHandle jobCount={props.jobs.length} peekTitle={peekTitle} />
      </Pressable>
      {expanded || isEmpty || props.jobs.length > 0 ? (
        <FlatList
          data={props.jobs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => props.renderJob(item)}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          showsVerticalScrollIndicator
          contentContainerStyle={[
            styles.listContent,
            isEmpty && styles.listContentEmpty,
          ]}
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
            !props.isLoading && props.emptyHint ? (
              <View style={styles.sheetEmptyHint}>
                <Text style={styles.sheetEmptyHintText}>{props.emptyHint}</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            props.isFetchingNextPage
              ? <ActivityIndicator color={RADAR_DEEP_BLUE} style={{ marginVertical: 16 }} />
              : <View style={{ height: insets.bottom }} />
          }
          onEndReached={props.onEndReached}
          onEndReachedThreshold={0.35}
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
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RADAR_BORDER,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  handleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: RADAR_TITLE,
    textAlign: 'center',
  },
  handleTitleCentered: {
    fontSize: 14,
    fontWeight: '600',
    color: RADAR_MUTED,
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
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
    flexGrow: 1,
  },
  itemSeparator: {
    height: COMPACT_JOB_CARD_GAP,
  },
  listContentEmpty: {
    flexGrow: 0,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  sheetEmptyHint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sheetEmptyHintText: {
    fontSize: 12,
    fontWeight: '500',
    color: RADAR_MUTED,
    textAlign: 'center',
    lineHeight: 16,
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
