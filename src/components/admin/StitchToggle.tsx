import React from 'react';
import {
  View, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { M3 } from '@constants/stitchStyles';

interface StitchToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
}

export const StitchToggle: React.FC<StitchToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  loading = false,
}) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() => !disabled && !loading && onValueChange(!value)}
    disabled={disabled || loading}
    style={[styles.track, value ? styles.trackOn : styles.trackOff]}
  >
    {loading ? (
      <ActivityIndicator size="small" color={M3.primary} style={styles.loader} />
    ) : (
      <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
    )}
  </TouchableOpacity>
);

const TRACK_W = 48;
const THUMB = 24;

const styles = StyleSheet.create({
  track: {
    width:           TRACK_W,
    height:          THUMB,
    borderRadius:    THUMB / 2,
    justifyContent:  'center',
    paddingHorizontal: 2,
  },
  trackOn:  { backgroundColor: M3.primary },
  trackOff: { backgroundColor: M3.outlineVariant },
  thumb: {
    width:           THUMB - 4,
    height:          THUMB - 4,
    borderRadius:    (THUMB - 4) / 2,
    backgroundColor: M3.surfaceContainerLowest,
  },
  thumbOn:  { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },
  loader:   { alignSelf: 'center' },
});
