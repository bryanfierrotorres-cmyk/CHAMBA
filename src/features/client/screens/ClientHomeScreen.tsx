import React, { useRef, useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ScrollView, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@store/authStore';
import { FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/theme';
import { SUGGESTED_PRICES } from '@constants/servicePricing';
import { DB_JOB_CATEGORY } from '@constants/chambaCategories';
import { formatCurrency } from '@utils/formatters';
import {
  M3, CARD_ELEVATION, stitchTypography,
} from '@constants/stitchStyles';
import type { ClientStackParamList, JobCategory } from '@/types';

type Nav = NativeStackNavigationProp<ClientStackParamList, 'CategoryGrid'>;

type ClientMainTab = 'limpieza' | 'vehiculos' | 'mascotas' | 'hogar';

interface ClientSubcategory {
  id: JobCategory;
  label: string;
  description: string;
  /** Etiqueta legacy visible en UI (sofas, alfombra…) */
  legacyDbLabel?: string;
}

const { width: SCREEN_W } = Dimensions.get('window');

const MAIN_TABS: { id: ClientMainTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'limpieza',  label: 'Limpieza',  icon: 'sparkles-outline' },
  { id: 'vehiculos', label: 'Vehículos', icon: 'car-outline' },
  { id: 'mascotas',  label: 'Mascotas',  icon: 'paw-outline' },
  { id: 'hogar',     label: 'Hogar',     icon: 'home-outline' },
];

/** Subcategorías por pestaña — Limpieza usa IDs legacy de BD (sofas, alfombra). */
const SUBCATEGORIES_BY_TAB: Record<ClientMainTab, ClientSubcategory[]> = {
  limpieza: [
    {
      id: 'limpieza_sofas',
      label: 'Limpieza de Sofás',
      description: 'Tapicería, cuero y tela',
      legacyDbLabel: DB_JOB_CATEGORY.limpieza_sofas,
    },
    {
      id: 'limpieza_alfombra',
      label: 'Limpieza de Alfombra',
      description: 'Residencial profunda',
      legacyDbLabel: DB_JOB_CATEGORY.limpieza_alfombra,
    },
    {
      id: 'alfombra_institucional',
      label: 'Alfombra Institucional',
      description: 'Oficinas y centros comerciales',
      legacyDbLabel: DB_JOB_CATEGORY.alfombra_institucional,
    },
    {
      id: 'fumigacion',
      label: 'Fumigación',
      description: 'Control de plagas certificado',
      legacyDbLabel: DB_JOB_CATEGORY.fumigacion,
    },
  ],
  vehiculos: [
    {
      id: 'vehiculo_profundo',
      label: 'Detallado de Vehículo',
      description: 'Limpieza interior y exterior profunda',
      legacyDbLabel: DB_JOB_CATEGORY.vehiculo_profundo,
    },
  ],
  mascotas: [],
  hogar: [
    {
      id: 'conserjeria_ocasional',
      label: 'Conserjería Ocasional',
      description: 'Limpieza puntual por evento',
      legacyDbLabel: DB_JOB_CATEGORY.conserjeria_ocasional,
    },
    {
      id: 'conserjeria_contrato',
      label: 'Conserjería por Contrato',
      description: 'Servicio mensual fijo',
      legacyDbLabel: DB_JOB_CATEGORY.conserjeria_contrato,
    },
    {
      id: 'jardineria',
      label: 'Jardinería',
      description: 'Poda, riego y mantenimiento',
      legacyDbLabel: DB_JOB_CATEGORY.jardineria,
    },
  ],
};

const CATEGORY_ICONS: Record<JobCategory, keyof typeof Ionicons.glyphMap> = {
  limpieza_sofas:          'bed-outline',
  limpieza_alfombra:       'layers-outline',
  alfombra_institucional:  'business-outline',
  fumigacion:              'bug-outline',
  vehiculo_profundo:       'car-sport-outline',
  conserjeria_ocasional:   'time-outline',
  conserjeria_contrato:    'document-text-outline',
  jardineria:              'leaf-outline',
};

// ─── Tarjeta horizontal Stitch ─────────────────────────────────────────────────

interface SubcategoryRowProps {
  item: ClientSubcategory;
  onPress: () => void;
}

const SubcategoryRow: React.FC<SubcategoryRowProps> = ({ item, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const price = SUGGESTED_PRICES[item.id];
  const icon  = CATEGORY_ICONS[item.id];

  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.98, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(onPress);
  };

  return (
    <TouchableOpacity onPress={press} activeOpacity={1}>
      <Animated.View style={[styles.subRow, { transform: [{ scale }] }]}>
        <View style={styles.subIconWrap}>
          <Ionicons name={icon} size={24} color={M3.primary} />
        </View>

        <View style={styles.subBody}>
          <Text style={styles.subTitle} numberOfLines={1}>{item.label}</Text>
          <Text style={styles.subDesc} numberOfLines={1}>{item.description}</Text>
          <View style={styles.subMetaRow}>
            {item.legacyDbLabel ? (
              <View style={styles.legacyPill}>
                <Text style={styles.legacyPillText}>{item.legacyDbLabel}</Text>
              </View>
            ) : null}
            <Text style={styles.subPrice}>desde {formatCurrency(price)}</Text>
          </View>
        </View>

        <View style={styles.subChevron}>
          <Ionicons name="chevron-forward" size={18} color={M3.onPrimaryContainer} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export const ClientHomeScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();
  const profile    = useAuthStore((s) => s.profile);
  const [activeTab, setActiveTab] = useState<ClientMainTab>('limpieza');

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Cliente';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  const handlePress = (categoryId: JobCategory, serviceLabel: string) => {
    navigation.navigate('CreateJobForm', { clientCategory: categoryId, serviceLabel });
  };

  const visibleSubcategories = useMemo(
    () => SUBCATEGORIES_BY_TAB[activeTab],
    [activeTab],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Top bar minimalista ── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greetingSmall}>{greeting}</Text>
          <Text style={styles.greetingName}>{firstName}</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {(profile?.full_name ?? 'C')[0].toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* ── Hero ultra-limpio ── */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>CHAMBA</Text>
          <Text style={styles.heroTitle}>¿Qué servicio{'\n'}necesitas?</Text>
          <Text style={styles.heroSub}>
            Elige una categoría y publica tu subasta en minutos.
          </Text>
        </View>

        {/* ── Pestañas principales (Stitch) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {MAIN_TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.85}
                style={[styles.tabPill, selected && styles.tabPillActive]}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={selected ? M3.onPrimaryContainer : M3.onSurfaceVariant}
                />
                <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Lista dinámica de subcategorías ── */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>
            {MAIN_TABS.find((t) => t.id === activeTab)?.label}
          </Text>
          <Text style={styles.listSub}>
            {visibleSubcategories.length}{' '}
            {visibleSubcategories.length === 1 ? 'servicio disponible' : 'servicios disponibles'}
          </Text>

          {visibleSubcategories.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="paw-outline" size={32} color={M3.outline} />
              <Text style={styles.emptyTitle}>Próximamente</Text>
              <Text style={styles.emptySub}>
                Estamos preparando servicios para mascotas. Mientras tanto, explora Limpieza u Hogar.
              </Text>
            </View>
          ) : (
            <View style={styles.subList}>
              {visibleSubcategories.map((item) => (
                <SubcategoryRow
                  key={item.id}
                  item={item}
                  onPress={() => handlePress(item.id, item.label)}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Trust strip ── */}
        <View style={styles.trustStrip}>
          {[
            { icon: 'shield-checkmark-outline' as const, text: 'Técnicos verificados' },
            { icon: 'star-outline' as const, text: 'Calificación 4.8+' },
            { icon: 'flash-outline' as const, text: 'Respuesta en menos de 1 h' },
          ].map(({ icon, text }) => (
            <View key={text} style={styles.trustItem}>
              <Ionicons name={icon} size={15} color={M3.primary} />
              <Text style={styles.trustText}>{text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles (Stitch — rounded-3xl + ambient-shadow) ───────────────────────────

const R3XL = 24;

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: M3.background,
  },

  topBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    backgroundColor:   M3.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: M3.surfaceVariant,
  },
  greetingSmall: {
    ...stitchTypography.labelBold,
    color: M3.outline,
  },
  greetingName: {
    ...stitchTypography.headlineMdMobile,
    fontWeight: '800',
  },
  avatarCircle: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: M3.primaryContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarLetter: {
    color:      M3.onPrimaryContainer,
    fontWeight: '800',
    fontSize:   FONT_SIZE.md,
  },

  scroll: {
    paddingHorizontal: SPACING.md,
  },

  hero: {
    backgroundColor:   M3.surfaceContainerLowest,
    borderRadius:      R3XL,
    padding:           SPACING.lg,
    marginTop:         SPACING.md,
    ...CARD_ELEVATION,
  },
  heroEyebrow: {
    ...stitchTypography.labelBold,
    color:         M3.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...stitchTypography.headlineLg,
    marginTop:  SPACING.xs,
    lineHeight: 34,
  },
  heroSub: {
    ...stitchTypography.bodySm,
    marginTop: SPACING.sm,
  },

  tabScroll: {
    gap:              SPACING.sm,
    paddingVertical:  SPACING.md,
    paddingHorizontal: 2,
  },
  tabPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm + 2,
    borderRadius:      BORDER_RADIUS.full,
    backgroundColor:   M3.surfaceContainerLowest,
    borderWidth:       1,
    borderColor:       M3.outlineVariant,
    ...CARD_ELEVATION,
  },
  tabPillActive: {
    backgroundColor: M3.primaryContainer,
    borderColor:     M3.primaryContainer,
  },
  tabLabel: {
    ...stitchTypography.labelBold,
    color: M3.onSurfaceVariant,
  },
  tabLabelActive: {
    color: M3.onPrimaryContainer,
  },

  listSection: {
    marginTop: SPACING.xs,
  },
  listTitle: {
    ...stitchTypography.headlineMdMobile,
    paddingHorizontal: 4,
  },
  listSub: {
    ...stitchTypography.labelBold,
    color:             M3.outline,
    paddingHorizontal: 4,
    marginBottom:      SPACING.md,
    marginTop:         2,
  },
  subList: {
    gap: SPACING.sm + 4,
  },

  subRow: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   M3.surfaceContainerLowest,
    borderRadius:      R3XL,
    padding:           SPACING.md,
    gap:               SPACING.sm + 4,
    borderWidth:       1,
    borderColor:       M3.surfaceVariant,
    maxWidth:          Math.min(SCREEN_W, 800),
    ...CARD_ELEVATION,
  },
  subIconWrap: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: M3.surfaceContainer,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  subBody: {
    flex: 1,
    minWidth: 0,
  },
  subTitle: {
    ...stitchTypography.bodyLg,
    fontWeight: '700',
    fontSize:   15,
  },
  subDesc: {
    ...stitchTypography.bodySm,
    marginTop: 2,
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems:  'center',
    gap:         SPACING.xs,
    marginTop:   6,
    flexWrap:    'wrap',
  },
  legacyPill: {
    backgroundColor:   M3.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      BORDER_RADIUS.full,
  },
  legacyPillText: {
    ...stitchTypography.labelBold,
    color:         M3.onPrimaryFixedVariant,
    fontSize:      10,
    textTransform: 'lowercase',
  },
  subPrice: {
    ...stitchTypography.labelBold,
    color: M3.primaryContainer,
  },
  subChevron: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: M3.primaryFixed,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  emptyCard: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius:    R3XL,
    padding:         SPACING.xl,
    alignItems:      'center',
    gap:             SPACING.sm,
    borderWidth:     1,
    borderColor:     M3.surfaceVariant,
    ...CARD_ELEVATION,
  },
  emptyTitle: {
    ...stitchTypography.headlineMdMobile,
  },
  emptySub: {
    ...stitchTypography.bodySm,
    textAlign: 'center',
  },

  trustStrip: {
    marginTop:         SPACING.lg,
    backgroundColor:   M3.surfaceContainerLowest,
    borderRadius:      R3XL,
    padding:           SPACING.md,
    gap:               SPACING.sm,
    borderWidth:       1,
    borderColor:       M3.surfaceVariant,
    ...CARD_ELEVATION,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
  },
  trustText: {
    ...stitchTypography.bodySm,
    color: M3.onSurfaceVariant,
  },
});
