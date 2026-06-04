import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import { buildGroupedServiceTypes } from '@constants/servicesConfig';
import { formatCurrency } from '@utils/formatters';
import type { JobCategory } from '@/types';

interface ServiceCatalogGroupsProps {
  /** Slugs seleccionados por el trabajador (category_1 / category_2). */
  highlightSlugs?: JobCategory[];
  compact?: boolean;
}

/**
 * Vista del catálogo canónico agrupado — misma estructura que Cliente / Admin publicar.
 */
export const ServiceCatalogGroups: React.FC<ServiceCatalogGroupsProps> = ({
  highlightSlugs = [],
  compact = false,
}) => {
  const { serviceTypes, isError } = useCatalog();
  const grouped = useMemo(() => {
    try {
      return buildGroupedServiceTypes(serviceTypes ?? []);
    } catch (err) {
      console.warn('[ServiceCatalogGroups]', err);
      return [];
    }
  }, [serviceTypes]);
  const highlight = new Set(highlightSlugs.filter(Boolean));

  if (isError || grouped.length === 0) {
    return (
      <Text style={styles.empty}>Catálogo no disponible. Reintentá en unos segundos.</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {grouped.map(({ group, types }) => (
        <View key={group.id} style={styles.group}>
          <Text style={styles.groupTitle}>
            {group.icon} {group.label}
          </Text>
          {types.map((st) => {
            if (!st?.slug) return null;
            const isHighlight = highlight.has(st.slug);
            const price = Number(st.suggested_price) || 0;
            return (
              <View
                key={st.slug}
                style={[styles.row, compact && styles.rowCompact, isHighlight && styles.rowHighlight]}
              >
                <Text style={styles.rowEmoji}>{st.icon ?? '📋'}</Text>
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={2}>{st.name ?? st.slug}</Text>
                  {!compact && st.description ? (
                    <Text style={styles.rowDesc} numberOfLines={2}>{st.description}</Text>
                  ) : null}
                </View>
                <View style={styles.rowRight}>
                  {price > 0 && (
                    <Text style={styles.rowPrice}>{formatCurrency(price)}</Text>
                  )}
                  {isHighlight && (
                    <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  group: { marginBottom: 16 },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowCompact: { paddingVertical: 8 },
  rowHighlight: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  rowEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  rowDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowPrice: { fontSize: 12, fontWeight: '600', color: '#0284C7' },
  empty: { fontSize: 14, color: '#94A3B8', textAlign: 'center', paddingVertical: 12 },
});
