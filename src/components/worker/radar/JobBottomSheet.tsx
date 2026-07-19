import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  FlatList,
  Pressable,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

/** ~2 filas visibles en el snap inicial del sheet (tarjetas de alta conversión). */
const COMPACT_PEEK_ROWS = 2;
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

export interface JobBottomSheetHandle {
  /** Baja la hoja a su estado normal/compacto (ej. tras apartar una solicitud). */
  collapse: () => void;
}

const SheetHandle: React.FC<{
  jobCount: number;
  peekTitle?: string;
  expanded?: boolean;
}> = ({
  jobCount,
  peekTitle,
  expanded,
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
    {jobCount > 0 ? (
      <View style={styles.handleHintRow}>
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={RADAR_MUTED}
        />
        <Text style={styles.handleHint}>
          {expanded ? 'Deslizá hacia abajo para ver el mapa' : 'Deslizá hacia arriba para ver más'}
        </Text>
      </View>
    ) : null}
  </View>
);

const NativeJobBottomSheet = forwardRef<JobBottomSheetHandle, JobBottomSheetProps>(({
  jobs,
  isLoading,
  isFetchingNextPage,
  onEndReached,
  listHeader,
  renderJob,
  emptyHint,
}, ref) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetRef = useRef<BottomSheet>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
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

  const toggleSheet = useCallback(() => {
    const nextIndex = sheetIndex === 0 ? 1 : 0;
    sheetRef.current?.snapToIndex(nextIndex);
    setSheetIndex(nextIndex);
  }, [sheetIndex]);

  useImperativeHandle(ref, () => ({
    collapse: () => {
      sheetRef.current?.snapToIndex(0);
      setSheetIndex(0);
    },
  }), []);

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      enableOverDrag={false}
      enableHandlePanningGesture
      onChange={setSheetIndex}
      handleComponent={() => (
        <Pressable onPress={toggleSheet} accessibilityRole="button">
          <SheetHandle
            jobCount={jobs.length}
            peekTitle={peekTitle}
            expanded={sheetIndex > 0}
          />
        </Pressable>
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
});
NativeJobBottomSheet.displayName = 'NativeJobBottomSheet';

const clampSheetHeight = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const WebJobBottomSheet = forwardRef<JobBottomSheetHandle, JobBottomSheetProps>((props, ref) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isEmpty = props.jobs.length === 0;
  const compactPeekHeight =
    COMPACT_JOB_CARD_HEIGHT * COMPACT_PEEK_ROWS
    + COMPACT_JOB_CARD_GAP * (COMPACT_PEEK_ROWS - 1)
    + SHEET_HANDLE_HEIGHT
    + 32;
  const compactHeight = isEmpty
    ? Math.min(118, height * 0.16)
    : Math.min(compactPeekHeight, height * 0.58);
  const expandedHeight = isEmpty ? height * 0.62 : height * 0.78;

  const heightAnim = useRef(new Animated.Value(compactHeight)).current;
  const dragStartHeight = useRef(compactHeight);
  const isPointerDown = useRef(false);
  const pointerStartY = useRef(0);
  const totalDragDy = useRef(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const snapTo = useCallback((target: number, expanded: boolean) => {
    setIsExpanded(expanded);
    Animated.spring(heightAnim, {
      toValue: target,
      useNativeDriver: false,
      tension: 120,
      friction: 14,
    }).start();
  }, [heightAnim]);

  const snapToNearest = useCallback((current: number) => {
    const mid = (compactHeight + expandedHeight) / 2;
    if (current >= mid) {
      snapTo(expandedHeight, true);
    } else {
      snapTo(compactHeight, false);
    }
  }, [compactHeight, expandedHeight, snapTo]);

  const toggleSheet = useCallback(() => {
    if (isExpanded) {
      snapTo(compactHeight, false);
    } else {
      snapTo(expandedHeight, true);
    }
  }, [compactHeight, expandedHeight, isExpanded, snapTo]);

  useEffect(() => {
    heightAnim.stopAnimation((current) => {
      const mid = (compactHeight + expandedHeight) / 2;
      const nextExpanded = current >= mid;
      snapTo(nextExpanded ? expandedHeight : compactHeight, nextExpanded);
    });
  }, [compactHeight, expandedHeight, heightAnim, snapTo]);

  useImperativeHandle(ref, () => ({
    collapse: () => snapTo(compactHeight, false),
  }), [compactHeight, snapTo]);

  const readPageY = useCallback((e: { nativeEvent: { pageY?: number; touches?: { pageY: number }[] } }) => {
    const ne = e.nativeEvent;
    if (typeof ne.pageY === 'number') return ne.pageY;
    if (ne.touches?.length) return ne.touches[0].pageY;
    return 0;
  }, []);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        totalDragDy.current = 0;
        heightAnim.stopAnimation((value) => {
          dragStartHeight.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        totalDragDy.current = gesture.dy;
        const next = clampSheetHeight(
          dragStartHeight.current - gesture.dy,
          compactHeight,
          expandedHeight,
        );
        heightAnim.setValue(next);
      },
      onPanResponderRelease: () => {
        if (Math.abs(totalDragDy.current) < 8) {
          toggleSheet();
          return;
        }
        heightAnim.stopAnimation((value) => {
          snapToNearest(value);
        });
      },
      onPanResponderTerminate: () => {
        heightAnim.stopAnimation((value) => {
          snapToNearest(value);
        });
      },
    }),
    [compactHeight, expandedHeight, heightAnim, snapToNearest, toggleSheet],
  );

  const webHandleGestures = useMemo(() => ({
    onPointerDown: (e: { nativeEvent: { pageY?: number; touches?: { pageY: number }[] }; preventDefault?: () => void }) => {
      isPointerDown.current = true;
      pointerStartY.current = readPageY(e);
      totalDragDy.current = 0;
      heightAnim.stopAnimation((value) => {
        dragStartHeight.current = value;
      });
    },
    onPointerMove: (e: { nativeEvent: { pageY?: number; touches?: { pageY: number }[] }; preventDefault?: () => void }) => {
      if (!isPointerDown.current) return;
      const dy = readPageY(e) - pointerStartY.current;
      totalDragDy.current = dy;
      const next = clampSheetHeight(
        dragStartHeight.current - dy,
        compactHeight,
        expandedHeight,
      );
      heightAnim.setValue(next);
      e.preventDefault?.();
    },
    onPointerUp: () => {
      if (!isPointerDown.current) return;
      isPointerDown.current = false;
      if (Math.abs(totalDragDy.current) < 8) {
        toggleSheet();
        return;
      }
      heightAnim.stopAnimation((value) => {
        snapToNearest(value);
      });
    },
    onPointerCancel: () => {
      isPointerDown.current = false;
      heightAnim.stopAnimation((value) => {
        snapToNearest(value);
      });
    },
  }), [compactHeight, expandedHeight, heightAnim, readPageY, snapToNearest, toggleSheet]);

  const peekTitle = props.jobs[0]?.title?.trim();

  return (
    <Animated.View
      style={[
        styles.webSheet,
        { height: Animated.add(heightAnim, insets.bottom) },
      ]}
    >
      <View
        style={[styles.webHandle, styles.webHandleDraggable]}
        {...(Platform.OS === 'web' ? webHandleGestures : panResponder.panHandlers)}
      >
        <SheetHandle
          jobCount={props.jobs.length}
          peekTitle={peekTitle}
          expanded={isExpanded}
        />
      </View>
      <FlatList
        style={styles.webList}
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
    </Animated.View>
  );
});
WebJobBottomSheet.displayName = 'WebJobBottomSheet';

export const JobBottomSheet = forwardRef<JobBottomSheetHandle, JobBottomSheetProps>((props, ref) => {
  if (Platform.OS === 'web') {
    return <WebJobBottomSheet {...props} ref={ref} />;
  }
  return <NativeJobBottomSheet {...props} ref={ref} />;
});
JobBottomSheet.displayName = 'JobBottomSheet';

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
  handleHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  handleHint: {
    fontSize: 11,
    fontWeight: '500',
    color: RADAR_MUTED,
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
  webHandleDraggable: Platform.select({
    web: {
      cursor: 'grab',
      touchAction: 'none',
      userSelect: 'none',
    } as Record<string, string>,
    default: {},
  }),
  webList: {
    flex: 1,
  },
});
