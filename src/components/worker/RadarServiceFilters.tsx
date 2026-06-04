import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
import { Ionicons } from '@expo/vector-icons';
import { CategoryIconCircle } from '@utils/categoryVisual';
import { M3, SPACING, BORDER_RADIUS, CARD_ELEVATION } from '@constants/stitchStyles';

export interface RadarServiceItem {
  slug: string;
  label: string;
}

interface Props {
  items: RadarServiceItem[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

const ServiceTile: React.FC<{
  slug: string;
  label: string;
  isActive: boolean;
  onPress: () => void;
  flex?: boolean;
}> = ({ slug, label, isActive, onPress, flex = false }) => (
  <ChambaPressable
    onPress={onPress}
    style={[
      styles.tile,
      flex && styles.tileFlex,
      isActive && styles.tileActive,
    ]}
  >
    <CategoryIconCircle category={slug} size={48} />
    <Text style={[styles.tileLabel, isActive && styles.tileLabelActive]} numberOfLines={2}>
      {label}
    </Text>
    <View style={[styles.tileBadge, isActive && styles.tileBadgeActive]}>
      {isActive ? (
        <>
          <Ionicons name="checkmark-circle" size={14} color={M3.onPrimaryContainer} />
          <Text style={styles.tileBadgeTextActive}>Filtrando</Text>
        </>
      ) : (
        <Text style={styles.tileBadgeText}>Toca para filtrar</Text>
      )}
    </View>
  </ChambaPressable>
);

export const RadarServiceFilters: React.FC<Props> = ({
  items,
  selectedSlug,
  onSelect,
}) => {
  if (items.length === 0) return null;

  const useGrid = items.length <= 2;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>TUS SERVICIOS EN EL RADAR</Text>
        {selectedSlug && (
          <TouchableOpacity
            onPress={() => onSelect(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ver todos los servicios"
          >
            <Text style={styles.clearLink}>Ver todos</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        {useGrid ? (
          <View style={styles.grid}>
            {items.map((item) => (
              <ServiceTile
                key={item.slug}
                slug={item.slug}
                label={item.label}
                isActive={selectedSlug === item.slug}
                onPress={() => onSelect(selectedSlug === item.slug ? null : item.slug)}
                flex
              />
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {items.map((item) => (
              <ServiceTile
                key={item.slug}
                slug={item.slug}
                label={item.label}
                isActive={selectedSlug === item.slug}
                onPress={() => onSelect(selectedSlug === item.slug ? null : item.slug)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: M3.onSurfaceVariant,
  },
  clearLink: {
    fontSize: 13,
    fontWeight: '700',
    color: M3.primary,
  },
  card: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: 12,
    padding: SPACING.sm + 4,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    ...CARD_ELEVATION,
  },
  grid: {
    flexDirection: 'row',
    gap: SPACING.sm + 4,
  },
  scrollContent: {
    gap: SPACING.sm + 4,
    paddingHorizontal: 2,
  },
  tile: {
    minWidth: 148,
    backgroundColor: M3.surfaceContainerLow,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tileFlex: {
    flex: 1,
    minWidth: 0,
  },
  tileActive: {
    backgroundColor: M3.primaryContainer,
    borderColor: M3.primary,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: M3.onBackground,
    textAlign: 'center',
    lineHeight: 18,
  },
  tileLabelActive: {
    color: M3.onPrimaryContainer,
    fontWeight: '700',
  },
  tileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: M3.surfaceContainerHighest,
  },
  tileBadgeActive: {
    backgroundColor: M3.surfaceContainerLowest,
  },
  tileBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: M3.onSurfaceVariant,
  },
  tileBadgeTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: M3.onPrimaryContainer,
  },
});
