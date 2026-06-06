import React from 'react';
import {
  View, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';

const SWITCH_ON = '#1E293B';
const SWITCH_OFF = '#F3F4F6';
const SWITCH_THUMB = '#FFFFFF';

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
      <ActivityIndicator size="small" color={SWITCH_ON} style={styles.loader} />
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
    borderRadius:    12,
    justifyContent:  'center',
    paddingHorizontal: 2,
  },
  trackOn:  { backgroundColor: SWITCH_ON },
  trackOff: { backgroundColor: SWITCH_OFF },
  thumb: {
    width:           THUMB - 4,
    height:          THUMB - 4,
    borderRadius:    12,
    backgroundColor: SWITCH_THUMB,
  },
  thumbOn:  { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },
  loader:   { alignSelf: 'center' },
});
