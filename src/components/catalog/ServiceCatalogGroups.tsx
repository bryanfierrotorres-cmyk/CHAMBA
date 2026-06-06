import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import { buildGroupedServiceTypes, type CatalogGroup } from '@constants/servicesConfig';
import { formatCurrency } from '@utils/formatters';
import { CHAMBA } from '@constants/chambaUI';
import type { ServiceType } from '@features/catalog/types';
import type { JobCategory } from '@/types';

interface ServiceCatalogGroupsProps {
  /** Slugs seleccionados por el trabajador (category_1 / category_2). */
  highlightSlugs?: JobCategory[];
  compact?: boolean;
  /** Lista colapsable — pensada para el perfil del administrador. */
  accordion?: boolean;
  /** Modo admin: input editable de precio sugerido por servicio. */
  editablePrices?: boolean;
  priceValues?: Record<string, string>;
  onPriceChange?: (slug: string, value: string) => void;
  modifiedSlugs?: Set<string>;
}

type AccordionSection = {
  key: string;
  title: string;
  icon: string;
  totalCount: number;
  subsections: Array<{ label?: string; types: ServiceType[] }>;
};

const enableLayoutAnimation = () => {
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
};

const buildAccordionSections = (groups: CatalogGroup[]): AccordionSection[] => {
  const map = new Map<string, AccordionSection>();

  for (const { group, types } of groups) {
    const key = group.parentLabel ?? group.id;
    const title = group.parentLabel ?? group.label;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        key,
        title,
        icon: group.parentLabel ? '🔧' : group.icon,
        totalCount: types.length,
        subsections: [{ label: group.parentLabel ? group.label : undefined, types }],
      });
      continue;
    }

    existing.totalCount += types.length;
    existing.subsections.push({
      label: group.parentLabel ? group.label : undefined,
      types,
    });
  }

  return [...map.values()];
};

const ServiceRow: React.FC<{
  st: ServiceType;
  compact: boolean;
  isHighlight: boolean;
  indented?: boolean;
  isLast?: boolean;
  editablePrices?: boolean;
  priceValue?: string;
  onPriceChange?: (slug: string, value: string) => void;
  isModified?: boolean;
}> = ({
  st,
  compact,
  isHighlight,
  indented,
  isLast,
  editablePrices,
  priceValue,
  onPriceChange,
  isModified,
}) => {
  const price = Number(st.suggested_price) || 0;
  const displayPrice = priceValue ?? (price > 0 ? String(Math.round(price)) : '');

  return (
    <View
      style={[
        styles.row,
        compact && styles.rowCompact,
        indented && styles.rowIndented,
        isHighlight && styles.rowHighlight,
        isModified && styles.rowModified,
        indented && !isLast && styles.rowIndentedDivider,
        indented && isLast && styles.rowIndentedLast,
      ]}
    >
      <Text style={styles.rowEmoji}>{st.icon ?? '📋'}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={2}>{st.name ?? st.slug}</Text>
        {!compact && st.description ? (
          <Text style={styles.rowDesc} numberOfLines={2}>{st.description}</Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        {editablePrices ? (
          <View style={styles.priceEditWrap}>
            <Text style={styles.priceEditPrefix}>C$</Text>
            <TextInput
              style={styles.priceEditInput}
              value={displayPrice}
              onChangeText={(text) => onPriceChange?.(st.slug, text.replace(/[^\d.]/g, ''))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              selectTextOnFocus
            />
          </View>
        ) : price > 0 ? (
          <Text style={styles.rowPrice}>{formatCurrency(price)}</Text>
        ) : null}
        {isHighlight && !editablePrices ? (
          <Ionicons name="checkmark-circle" size={18} color="#15803D" />
        ) : null}
        {isModified && editablePrices ? (
          <View style={styles.modifiedDot} />
        ) : null}
      </View>
    </View>
  );
};

const AccordionCatalog: React.FC<{
  grouped: CatalogGroup[];
  compact: boolean;
  highlight: Set<string>;
  editablePrices?: boolean;
  priceValues?: Record<string, string>;
  onPriceChange?: (slug: string, value: string) => void;
  modifiedSlugs?: Set<string>;
}> = ({
  grouped,
  compact,
  highlight,
  editablePrices,
  priceValues,
  onPriceChange,
  modifiedSlugs,
}) => {
  const sections = useMemo(() => buildAccordionSections(grouped), [grouped]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    enableLayoutAnimation();
  }, []);

  const toggleSection = useCallback((key: string) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  return (
    <View style={styles.accordionWrap}>
      {sections.map((section, sectionIndex) => {
        const isExpanded = expandedKeys.includes(section.key);
        const isLastSection = sectionIndex === sections.length - 1;

        return (
          <View
            key={section.key}
            style={[styles.accordionItem, !isLastSection && styles.accordionItemGap]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.accordionHeader,
                isExpanded && styles.accordionHeaderExpanded,
                pressed && styles.accordionHeaderPressed,
                Platform.OS === 'web' && styles.accordionHeaderWeb,
              ]}
              onPress={() => toggleSection(section.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isExpanded }}
              accessibilityLabel={`${section.title}, ${section.totalCount} servicios`}
            >
              <View style={styles.accordionHeaderLeft}>
                <View style={styles.accordionIconWrap}>
                  <Text style={styles.accordionIcon}>{section.icon}</Text>
                </View>
                <View style={styles.accordionHeaderText}>
                  <Text style={styles.accordionTitle} numberOfLines={2}>{section.title}</Text>
                  <Text style={styles.accordionMeta}>
                    {section.totalCount} {section.totalCount === 1 ? 'servicio' : 'servicios'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={CHAMBA.muted}
              />
            </Pressable>

            {isExpanded && (
              <View style={styles.accordionBody}>
                {section.subsections.map((sub, subIndex) => (
                  <View key={`${section.key}-${sub.label ?? subIndex}`}>
                    {sub.label ? (
                      <Text style={styles.subsectionLabel}>{sub.label}</Text>
                    ) : null}
                    {sub.types.map((st, typeIndex) => {
                      if (!st?.slug) return null;
                      const isLastType =
                        subIndex === section.subsections.length - 1
                        && typeIndex === sub.types.length - 1;
                      return (
                        <ServiceRow
                          key={st.slug}
                          st={st}
                          compact={compact}
                          isHighlight={highlight.has(st.slug)}
                          indented
                          isLast={isLastType}
                          editablePrices={editablePrices}
                          priceValue={priceValues?.[st.slug]}
                          onPriceChange={onPriceChange}
                          isModified={modifiedSlugs?.has(st.slug)}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const FlatCatalog: React.FC<{
  grouped: CatalogGroup[];
  compact: boolean;
  highlight: Set<string>;
  editablePrices?: boolean;
  priceValues?: Record<string, string>;
  onPriceChange?: (slug: string, value: string) => void;
  modifiedSlugs?: Set<string>;
}> = ({
  grouped,
  compact,
  highlight,
  editablePrices,
  priceValues,
  onPriceChange,
  modifiedSlugs,
}) => (
  <View style={styles.wrap}>
    {grouped.map(({ group, types }) => (
      <View key={group.id} style={styles.group}>
        <Text style={styles.groupTitle}>
          {group.icon} {group.label}
        </Text>
        {types.map((st) => {
          if (!st?.slug) return null;
          return (
            <ServiceRow
              key={st.slug}
              st={st}
              compact={compact}
              isHighlight={highlight.has(st.slug)}
              editablePrices={editablePrices}
              priceValue={priceValues?.[st.slug]}
              onPriceChange={onPriceChange}
              isModified={modifiedSlugs?.has(st.slug)}
            />
          );
        })}
      </View>
    ))}
  </View>
);

/**
 * Vista del catálogo canónico agrupado — misma estructura que Cliente / Admin publicar.
 */
export const ServiceCatalogGroups: React.FC<ServiceCatalogGroupsProps> = ({
  highlightSlugs = [],
  compact = false,
  accordion = false,
  editablePrices = false,
  priceValues,
  onPriceChange,
  modifiedSlugs,
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
  const highlight = useMemo(
    () => new Set(highlightSlugs.filter(Boolean)),
    [highlightSlugs],
  );

  if (isError || grouped.length === 0) {
    return (
      <Text style={styles.empty}>Catálogo no disponible. Reintentá en unos segundos.</Text>
    );
  }

  const priceProps = {
    editablePrices,
    priceValues,
    onPriceChange,
    modifiedSlugs,
  };

  if (accordion || editablePrices) {
    return (
      <AccordionCatalog
        grouped={grouped}
        compact={compact}
        highlight={highlight}
        {...priceProps}
      />
    );
  }

  return <FlatCatalog grouped={grouped} compact={compact} highlight={highlight} {...priceProps} />;
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

  accordionWrap: { marginBottom: 4 },
  accordionItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CHAMBA.border,
    backgroundColor: CHAMBA.white,
    overflow: 'hidden',
  },
  accordionItemGap: { marginBottom: 10 },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  accordionHeaderExpanded: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CHAMBA.border,
  },
  accordionHeaderPressed: {
    opacity: 0.88,
  },
  accordionHeaderWeb: {
    cursor: 'pointer',
  } as const,
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  accordionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accordionIcon: { fontSize: 20 },
  accordionHeaderText: { flex: 1, minWidth: 0 },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CHAMBA.navy,
    letterSpacing: -0.2,
  },
  accordionMeta: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  accordionBody: {
    backgroundColor: '#F9FAFB',
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  subsectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 8,
  },
  rowIndented: {
    marginLeft: 8,
    marginRight: 0,
    marginBottom: 0,
    backgroundColor: CHAMBA.white,
    borderRadius: 10,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowIndentedDivider: {
    marginBottom: 0,
  },
  rowIndentedLast: {
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  rowModified: {
    backgroundColor: '#FFFBEB',
  },
  priceEditWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CHAMBA.white,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 8,
    minWidth: 92,
  },
  priceEditPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: CHAMBA.muted,
    marginRight: 4,
  },
  priceEditInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: CHAMBA.navy,
    paddingVertical: 6,
    minWidth: 48,
    textAlign: 'right',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as const,
  modifiedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginTop: 4,
  },
});
