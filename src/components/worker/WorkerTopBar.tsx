import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { M3, SPACING, stitchTypography } from '@constants/stitchStyles';

interface WorkerTopBarProps {
  avatarUri?:    string | null;
  avatarName?:   string;
  onNotifications?: () => void;
  showNotifications?: boolean;
}

export const WorkerTopBar: React.FC<WorkerTopBarProps> = ({
  avatarUri,
  avatarName = 'CHAMBA',
  onNotifications,
  showNotifications = false,
}) => (
  <View style={styles.bar}>
    <View style={styles.left}>
      <View style={styles.avatarWrap}>
        <Avatar uri={avatarUri} name={avatarName} size={32} />
      </View>
      <Text style={stitchTypography.appTitle}>CHAMBA</Text>
    </View>
    {showNotifications && (
      <TouchableOpacity
        onPress={onNotifications}
        style={styles.notifBtn}
        activeOpacity={0.75}
      >
        <Ionicons name="notifications-outline" size={24} color={M3.primary} />
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    height:            48,
    backgroundColor:   M3.background,
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  avatarWrap: {
    width:           32,
    height:          32,
    borderRadius:    16,
    overflow:        'hidden',
    backgroundColor: M3.surfaceVariant,
  },
  notifBtn: {
    width:           48,
    height:          48,
    borderRadius:    24,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
