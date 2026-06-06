import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import {
  RADAR_BORDER,
  RADAR_DEEP_BLUE,
  RADAR_FLOAT_BG,
  RADAR_HORIZONTAL,
  RADAR_MUTED,
} from './radarTheme';

export interface RadarFilterItem {
  slug: string;
  label: string;
}

interface FloatingRadarFiltersProps {
  topOffset: number;
  items: RadarFilterItem[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export const FloatingRadarFilters: React.FC<FloatingRadarFiltersProps> = ({
  topOffset,
  items,
  selectedSlug,
  onSelect,
}) => {
  if (items.length === 0) return null;

  return (
    <View style={[styles.wrap, { top: topOffset }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable
          style={[styles.pill, !selectedSlug && styles.pillActive]}
          onPress={() => onSelect(null)}
        >
          <Text style={[styles.pillText, !selectedSlug && styles.pillTextActive]}>
            Todos
          </Text>
        </Pressable>
        {items.map((item) => {
          const active = selectedSlug === item.slug;
          return (
            <Pressable
              key={item.slug}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onSelect(active ? null : item.slug)}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: RADAR_HORIZONTAL,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: RADAR_FLOAT_BG,
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    maxWidth: 160,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  pillActive: {
    backgroundColor: RADAR_DEEP_BLUE,
    borderColor: RADAR_DEEP_BLUE,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: RADAR_MUTED,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
});
