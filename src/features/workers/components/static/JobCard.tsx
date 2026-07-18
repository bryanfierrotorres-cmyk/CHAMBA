import React from 'react';
import { memo } from 'react';
const _keepReact = React;
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { M3, SPACING, BORDER_RADIUS } from '@constants/stitchStyles';
import { CARD_STEP_SHADOW } from '@constants/chambaUI';
import type { JobAssignment } from '@/types';

interface JobCardProps {
  assignment: JobAssignment;
  onPress?: (assignment: JobAssignment) => void;
}

const JobCardComponent: React.FC<JobCardProps> = ({ assignment, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.8}
      onPress={() => onPress?.(assignment)}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="briefcase-outline" size={20} color={M3.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {assignment.job?.title || 'Trabajo sin título'}
          </Text>
          <Text style={styles.status}>
            {assignment.selection_status === 'approved' ? 'Asignado' : 'Pendiente'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: M3.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: M3.surfaceVariant,
    ...CARD_STEP_SHADOW,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: M3.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: M3.onSurface,
  },
  status: {
    fontSize: 13,
    color: M3.onSurfaceVariant,
    marginTop: 2,
  },
});

export const JobCard = memo(JobCardComponent);
