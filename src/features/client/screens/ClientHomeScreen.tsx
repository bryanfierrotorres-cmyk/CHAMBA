import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HomeModeToggle } from '@components/client/HomeModeToggle';
import { ChambaServiceOptionRow } from '@components/chamba/ChambaServiceOptionRow';
import { B2bHireModeCards, type B2bHireMode } from '@components/client/B2bHireModeCards';
import {
  ExpressServiceCompactGrid,
  type ExpressCompactItem,
} from '@components/client/ExpressServiceCompactGrid';
import { PremiumSubcategoryList, SERVICE_LIST_BOTTOM_PAD } from '@components/client/PremiumSubcategoryList';
import { useSupportBubbleScrollHandlers } from '@hooks/useSupportBubbleScrollHandlers';
import { useClientLocationLabel } from '@hooks/useClientLocationLabel';
import { useAuthStore } from '@store/authStore';
import {
  CARD_STEP_SHADOW,
  CHAMBA,
  chambaStyles,
} from '@constants/chambaUI';
import { HOME_PALETTE } from '@constants/clientHomeTheme';
import {
  getServiceIconBg,
  renderEmpresaServiceIcon,
  renderSpecializedIcon,
} from '@constants/clientHomeServiceIcons';
import { formatCurrency } from '@utils/formatters';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import type { ExpressSubmenu } from '@constants/servicesConfig';
import {
  EXPRESS_MAIN_TILES,
  EXPRESS_SUB_TILES,
  EXPRESS_SUBMENU_META,
  EMPRESA_PREMIUM_ORDER,
  CLIENT_SPECIALIZED_SERVICES,
  type ExpressTileDef,
} from '@constants/clientHomeExpress';
import { ClientHomeHeroCarousel } from '@components/client/ClientHomeHeroCarousel';
import { ClientHomeSearchBar } from '@components/client/ClientHomeSearchBar';
import { openWhatsAppSupport } from '@utils/whatsappSupport';
import { EXPRESS_MAIN_SERVICE_IMAGES } from '@constants/clientHomeImages';
import {
  CLIENT_EMPRESA_HERO_SLIDES,
  CLIENT_HOGAR_HERO_SLIDES,
} from '@constants/clientHomeHeroSlides';
import type { ServiceType } from '@features/catalog/types';
import { useClientPublishLimit } from '@features/jobs/hooks/useJobActiveLimits';
import { SkeletonCard } from '@components/SkeletonCard';
import { SmoothEntrance } from '@components/SmoothEntrance';
import { AnimatedBottomSheet } from '@components/AnimatedBottomSheet';
import { CustomServiceCard, type CustomServiceCardRef } from '@components/client/CustomServiceCard';
import type { ClientStackParamList } from '@/types';

type Nav = NativeStackNavigationProp<ClientStackParamList, 'CategoryGrid'>;
type ActiveTab = 'hogar' | 'empresa';

const CYAN = CHAMBA.cyan;
const BLUE = CHAMBA.blue;

/** Altura del difuminado bajo el área segura (header + toggle + búsqueda). */
const HEADER_GRADIENT_BODY = 210;

const HEADER_GRADIENT_COLORS = ['#D4E9FC', '#F0F6FF', 'rgba(255,255,255,0)'] as const;

const premiumSortIndex = (slug: string): number => {
  const i = EMPRESA_PREMIUM_ORDER.indexOf(slug as (typeof EMPRESA_PREMIUM_ORDER)[number]);
  return i >= 0 ? i : 999;
};

/** Ícono vectorial por tile principal Express (spec Home v1.0 — sin ilustraciones). */
const EXPRESS_TILE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  limpieza: 'sparkles-outline',
  car: 'car-sport-outline',
  ac: 'snow-outline',
  jardineria: 'leaf-outline',
  pet: 'paw-outline',
  mandados: 'bicycle-outline',
};

export const ClientHomeScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const catalog = useCatalog();
  const publishLimit = useClientPublishLimit();
  const supportBubbleScroll = useSupportBubbleScrollHandlers();
  const locationLabel = useClientLocationLabel('Managua, Nicaragua');

  const scrollRef = useRef<ScrollView>(null);
  const expressSectionY = useRef(0);

  const [activeTab, setActiveTab] = useState<ActiveTab>('hogar');
  const [selectedExpressCat, setSelectedExpressCat] = useState<ExpressSubmenu | null>(null);
  const [b2bMode, setB2bMode] = useState<B2bHireMode>('jornadas');

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Cliente';

  const handlePress = (slug: string, serviceLabel: string, initialDesc?: string, initialPrice?: number) => {
    if (publishLimit.atLimit) {
      const msg = publishLimit.message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Límite de solicitudes', msg);
      return;
    }
    navigation.navigate('CreateJobForm', { 
      serviceTypeSlug: slug, 
      serviceLabel,
      initialDescription: initialDesc,
      initialOfferPrice: initialPrice,
    });
  };

  const priceFor = (slug: string | undefined, fallback: number): string => {
    if (!slug) return formatCurrency(fallback);
    const fromCatalog = catalog.getSuggestedPrice(slug);
    return formatCurrency(fromCatalog > 0 ? fromCatalog : fallback);
  };

  /** Precio "Desde" de una categoría — mínimo entre sus sub-servicios (dato real, no inventado). */
  const minCategoryPrice = (submenu: ExpressSubmenu): number => {
    const prices = EXPRESS_SUB_TILES[submenu]
      .map((t) => {
        const fromCatalog = t.slug ? catalog.getSuggestedPrice(t.slug) : 0;
        return fromCatalog > 0 ? fromCatalog : (t.fallbackPrice ?? 0);
      })
      .filter((p) => p > 0);
    return prices.length ? Math.min(...prices) : 0;
  };

  const filteredSpecialized = CLIENT_SPECIALIZED_SERVICES;

  const empresaTypes = useMemo((): ServiceType[] => {
    const allowed = new Set<string>(EMPRESA_PREMIUM_ORDER);
    return catalog.serviceTypes
      .filter((t) => allowed.has(t.slug))
      .sort((a, b) => premiumSortIndex(a.slug) - premiumSortIndex(b.slug));
  }, [catalog.serviceTypes]);

  const activeExpressTiles = useMemo((): ExpressTileDef[] => {
    if (selectedExpressCat) {
      return [
        ...EXPRESS_SUB_TILES[selectedExpressCat],
        {
          id: 'virtual_custom',
          title: 'Otro / Servicio Personalizado',
          slug: 'virtual_custom',
        }
      ];
    }
    return EXPRESS_MAIN_TILES;
  }, [selectedExpressCat]);

  const expressSectionMeta = selectedExpressCat
    ? EXPRESS_SUBMENU_META[selectedExpressCat]
    : null;

  const customServiceRef = useRef<CustomServiceCardRef>(null);

  const onExpressPress = (tile: ExpressTileDef) => {
    if (tile.submenu) {
      setSelectedExpressCat(prev => prev === tile.submenu ? null : (tile.submenu ?? null));
      return;
    }
    if (tile.slug === 'virtual_custom') {
      setSelectedExpressCat(null);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
        setTimeout(() => {
          customServiceRef.current?.focusDescription();
        }, 350); // Wait for the scroll animation
      }, 200); // Wait for the bottom sheet to start closing
      return;
    }
    if (tile.slug) {
      setSelectedExpressCat(null);
      setTimeout(() => {
        handlePress(tile.slug!, tile.title);
      }, 200); // Wait briefly so the modal animation starts closing smoothly
    }
  };

  const expressCompactItems = useMemo((): ExpressCompactItem[] => {
    return activeExpressTiles.map((tile) => {
      const isCategory = !!(tile.submenu || tile.priceLabel === 'Ver opciones');
      const price = isCategory && tile.submenu
        ? minCategoryPrice(tile.submenu)
        : (() => {
            const fromCatalog = tile.slug ? catalog.getSuggestedPrice(tile.slug) : 0;
            return fromCatalog > 0 ? fromCatalog : (tile.fallbackPrice ?? 0);
          })();
      return {
        id: tile.id,
        title: tile.title,
        description: tile.description,
        icon: selectedExpressCat ? undefined : EXPRESS_TILE_ICONS[tile.id],
        photoSource: selectedExpressCat
          ? null
          : (EXPRESS_MAIN_SERVICE_IMAGES[tile.id] ? { uri: EXPRESS_MAIN_SERVICE_IMAGES[tile.id] } : null),
        availableBadge: selectedExpressCat ? undefined : 'Disponible hoy',
        onPress: () => onExpressPress(tile),
        isCategory,
        footer: `Desde ${formatCurrency(price).replace(/\.00$/, '').replace(/C\$\s+/, 'C$')}`,
      };
    });
  }, [activeExpressTiles, selectedExpressCat, catalog.serviceTypes]);

  return (
    <View style={styles.screenRoot}>
      <LinearGradient
        pointerEvents="none"
        colors={[...HEADER_GRADIENT_COLORS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.headerGradient,
          { height: insets.top + HEADER_GRADIENT_BODY },
        ]}
      />

      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerStack}>
          <View style={styles.header}>
            <View style={styles.locationCol}>
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={15} color={HOME_PALETTE.blue} />
                <Text style={styles.locationText} numberOfLines={1}>{locationLabel}</Text>
                <Ionicons name="chevron-down" size={14} color={HOME_PALETTE.midGray} />
              </View>
            </View>
            <TouchableOpacity
              style={styles.bellButton}
              activeOpacity={0.7}
              accessibilityLabel="Notificaciones"
              accessibilityRole="button"
            >
              <Ionicons name="notifications-outline" size={22} color={HOME_PALETTE.darkGray} />
              <View style={styles.bellDot} />
            </TouchableOpacity>
          </View>

          <Image
            source={require('../../../../assets/cliente-mujer-telefono.png')}
            style={styles.greetingPhoto}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />

          <View style={styles.greetingBlock}>
            <View style={styles.greetingTextCol}>
              <Text style={styles.greetingText}>Hola, {firstName} 👋</Text>
              <Text style={styles.greetingSubtitle}>¿Qué necesitás hoy?</Text>
            </View>
          </View>

          {activeTab === 'hogar' && (
            <ClientHomeSearchBar
              serviceTypes={catalog.serviceTypes}
              onSelectService={handlePress}
              onSupportPress={() => void openWhatsAppSupport()}
            />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingBottom: insets.bottom + 120 },
          ]}
          keyboardShouldPersistTaps="handled"
          {...supportBubbleScroll}
        >
          {activeTab === 'hogar' && (
            <View>
              <ClientHomeHeroCarousel
                slides={CLIENT_HOGAR_HERO_SLIDES}
                onExpressCtaPress={() => {
                  scrollRef.current?.scrollTo({ y: Math.max(0, expressSectionY.current - 12), animated: true });
                }}
              />

            <View style={styles.modeToggle}>
              <HomeModeToggle
                value={activeTab}
                onChange={(id) => {
                  setActiveTab(id);
                  setSelectedExpressCat(null);
                }}
              />
            </View>

            <View style={styles.sectionHeader} onLayout={(e) => { expressSectionY.current = e.nativeEvent.layout.y; }}>
              <View>
                <Text style={styles.expressSectionTitle}>
                  {'Servicios Express'}
                </Text>
                <Text style={styles.expressSectionSubtitle}>
                  {'Los más solicitados hoy en tu zona'}
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.verTodos}>Ver todos →</Text>
              </TouchableOpacity>
            </View>

            {catalog.isLoading ? (
              <View style={styles.gridContainer}>
                {[1, 2, 3, 4, 5, 6].map((key) => (
                  <SkeletonCard key={key} variant="grid" />
                ))}
              </View>
            ) : (
              <SmoothEntrance>
                <ExpressServiceCompactGrid items={expressCompactItems} />
              </SmoothEntrance>
            )}

            <AnimatedBottomSheet
              visible={!!selectedExpressCat}
              onClose={() => setSelectedExpressCat(null)}
            >
              {selectedExpressCat && (
                <View style={{ paddingHorizontal: 20 }}>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>{expressSectionMeta?.sectionTitle ?? 'Opciones'}</Text>
                    <Text style={styles.sheetSubtitle}>{expressSectionMeta?.sectionSubtitle ?? 'Selecciona un servicio'}</Text>
                  </View>
                  <PremiumSubcategoryList
                    tiles={activeExpressTiles}
                    submenu={selectedExpressCat}
                    serviceTypes={catalog.serviceTypes}
                    getSuggestedPrice={(slug, fallback = 0) => {
                      const fromCatalog = catalog.getSuggestedPrice(slug);
                      return fromCatalog > 0 ? fromCatalog : fallback;
                    }}
                    onTilePress={onExpressPress}
                    listBottomPadding={insets.bottom}
                  />
                </View>
              )}
            </AnimatedBottomSheet>

            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <View style={chambaStyles.sectionHeader}>
                <Text style={chambaStyles.sectionTitle}>Servicios Especializados</Text>
                <Text style={chambaStyles.sectionSubtitle}>Cotización a tu medida</Text>
              </View>
            </View>

            {catalog.isLoading ? (
              <View style={{ gap: 12 }}>
                <SkeletonCard variant="request" />
                <SkeletonCard variant="request" />
              </View>
            ) : (
              <SmoothEntrance>
                {filteredSpecialized.map((item) => (
                  <ChambaServiceOptionRow
                    key={item.id}
                    title={item.title}
                    subtitle={item.subtitle}
                    iconColor={getServiceIconBg(item.id, item.slug)}
                    icon={renderSpecializedIcon(item.id)}
                    onPress={() => handlePress(item.slug, item.title)}
                    badge="BAJO COTIZACIÓN"
                  />
                ))}
              </SmoothEntrance>
            )}

            <CustomServiceCard
              ref={customServiceRef}
              disabled={publishLimit.atLimit}
              onSendRequest={(desc, price) => {
                handlePress('servicio_personalizado', 'Servicio Personalizado', desc, price);
              }}
            />



            <View style={styles.chambearBanner}>
              <Text style={styles.tagNuevo}>NUEVO</Text>
              <Text style={styles.chambearTitle}>¿Querés chambear?</Text>
              <Text style={styles.chambearSubtitle}>Unite como prestador de servicios hoy mismo.</Text>
            </View>
          </View>
        )}

        {activeTab === 'empresa' && (
          <View>
            <ClientHomeHeroCarousel slides={CLIENT_EMPRESA_HERO_SLIDES} />

            <View style={styles.modeToggle}>
              <HomeModeToggle
                value={activeTab}
                onChange={(id) => {
                  setActiveTab(id);
                  setSelectedExpressCat(null);
                }}
              />
            </View>

            <B2bHireModeCards value={b2bMode} onChange={setB2bMode} />

            <View style={styles.sectionHeader}>
              <View style={chambaStyles.sectionHeader}>
                <Text style={chambaStyles.sectionTitle}>Servicios Premium</Text>
                <Text style={chambaStyles.sectionSubtitle}>Personal capacitado para tu negocio</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.verTodos}>Ver todos →</Text>
              </TouchableOpacity>
            </View>

            {catalog.isLoading ? (
              <View style={{ gap: 12 }}>
                <SkeletonCard variant="request" />
                <SkeletonCard variant="request" />
              </View>
            ) : empresaTypes.length === 0 ? (
              <SmoothEntrance>
                <View style={chambaStyles.emptyCard}>
                  <Ionicons name="business-outline" size={32} color={CHAMBA.muted} />
                  <Text style={chambaStyles.cardTitle}>Sin servicios en esta vista</Text>
                  <Text style={chambaStyles.cardSubtitle}>Cambiá a Para tu Hogar para ver más.</Text>
                </View>
              </SmoothEntrance>
            ) : (
              <SmoothEntrance>
                {empresaTypes.map((item) => {
                  const price = catalog.getSuggestedPrice(item.slug);
                  return (
                    <ChambaServiceOptionRow
                      key={item.id}
                      title={catalog.getLabel(item.slug) || item.name}
                      subtitle={item.description ?? 'Personal capacitado para tu negocio'}
                      iconColor={getServiceIconBg(item.slug, item.slug)}
                      icon={renderEmpresaServiceIcon(item.slug)}
                      onPress={() => handlePress(item.slug, catalog.getLabel(item.slug) || item.name)}
                      badge="ALTA DEMANDA"
                      priceLine={`Desde ${formatCurrency(price)}/día`}
                    />
                  );
                })}
              </SmoothEntrance>
            )}
          </View>
        )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: HOME_PALETTE.bg,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerStack: {
    zIndex: 1,
    paddingHorizontal: 16,
  },
  scrollContainer: { paddingHorizontal: 16, paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  locationCol: { flexShrink: 0 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { fontSize: 15, fontWeight: '500', color: HOME_PALETTE.locationGray, maxWidth: 170 },
  bellButton: {
    flexShrink: 0,
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HOME_PALETTE.blue,
    borderWidth: 1.5,
    borderColor: HOME_PALETTE.bg,
  },
  greetingBlock: {
    marginTop: 28,
    marginBottom: 20,
  },
  greetingTextCol: {
    paddingRight: 140,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: HOME_PALETTE.darkGray,
    letterSpacing: -0.2,
  },
  greetingSubtitle: {
    fontSize: 21,
    fontWeight: '800',
    color: HOME_PALETTE.darkGray,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  greetingPhoto: {
    position: 'absolute',
    top: 22,
    right: 0,
    width: 132,
    height: 164,
    zIndex: 0,
  },
  secretFlashHit: {
    opacity: 0.42,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  adminSecretBtn: {
    alignSelf: 'center',
    marginTop: -4,
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    opacity: 0.55,
  },
  adminSecretBtnText: {
    color: CHAMBA.muted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  modeToggle: { marginTop: 4, marginBottom: 24 },



  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expressSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: HOME_PALETTE.darkGray,
    letterSpacing: -0.2,
  },
  expressSectionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: HOME_PALETTE.midGray,
    marginTop: 2,
  },
  verTodos: { fontSize: 14, fontWeight: '700', color: HOME_PALETTE.blue },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CHAMBA.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    minWidth: 48,
    minHeight: 48,
    borderWidth: 1,
    borderColor: CHAMBA.border,
    ...CARD_STEP_SHADOW,
  },
  backBtnText: { fontSize: 14, fontWeight: '700', color: BLUE },

  chambearBanner: {
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    borderRadius: 18,
    padding: 20,
    marginTop: 20,
    position: 'relative',
  },
  tagNuevo: {
    position: 'absolute',
    top: 12,
    left: 20,
    backgroundColor: CYAN,
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  chambearTitle: { fontSize: 18, fontWeight: '800', color: BLUE, marginTop: 10, marginBottom: 4 },
  chambearSubtitle: { fontSize: 12, color: '#0369A1' },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 20,
    rowGap: 20,
    marginBottom: 12,
  },
  sheetHeader: {
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
});
