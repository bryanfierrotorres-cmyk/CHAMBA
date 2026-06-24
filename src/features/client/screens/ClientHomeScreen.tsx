import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
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
import { ChambaSlidingToggle } from '@components/chamba/ChambaSlidingToggle';
import { ChambaServiceOptionRow } from '@components/chamba/ChambaServiceOptionRow';
import { B2bHireModeCards, type B2bHireMode } from '@components/client/B2bHireModeCards';
import {
  ExpressServiceCompactGrid,
  type ExpressCompactItem,
} from '@components/client/ExpressServiceCompactGrid';
import { PremiumSubcategoryList, SERVICE_LIST_BOTTOM_PAD } from '@components/client/PremiumSubcategoryList';
import { useSupportBubbleScrollHandlers } from '@hooks/useSupportBubbleScrollHandlers';
import { useAuthStore } from '@store/authStore';
import { Avatar } from '@components/Avatar';
import {
  CARD_STEP_SHADOW,
  CHAMBA,
  chambaStyles,
  getSubcategoryIconColor,
} from '@constants/chambaUI';
import {
  getServiceIconBg,
  renderEmpresaServiceIcon,
  renderExpressTileIcon,
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
import { getService3dAsset, getService3dImageSize, getService3dImageOffsetY } from '@constants/service3dAssets';
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

export const ClientHomeScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const catalog = useCatalog();
  const publishLimit = useClientPublishLimit();
  const supportBubbleScroll = useSupportBubbleScrollHandlers();

  const scrollRef = useRef<ScrollView>(null);

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
      setSelectedExpressCat(prev => prev === tile.submenu ? null : tile.submenu);
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
      handlePress(tile.slug, tile.title);
    }
  };

  const expressCompactItems = useMemo((): ExpressCompactItem[] => {
    return activeExpressTiles.map((tile, index) => {
      const isCategory = !!(tile.submenu || tile.priceLabel === 'Ver opciones');
      const iconColor = selectedExpressCat
        ? getSubcategoryIconColor(index)
        : getServiceIconBg(tile.id, tile.slug);
      return {
        id: tile.id,
        title: tile.title,
        iconColor,
        icon: renderExpressTileIcon(tile.id, selectedExpressCat),
        imageSource: selectedExpressCat ? null : getService3dAsset(tile.id),
        imageSize: selectedExpressCat ? undefined : getService3dImageSize(tile.id),
        imageOffsetY: selectedExpressCat ? undefined : getService3dImageOffsetY(tile.id),
        onPress: () => onExpressPress(tile),
        isCategory,
        footer: isCategory
          ? 'VER OPCIONES'
          : `Desde ${priceFor(tile.slug, tile.fallbackPrice ?? 0)}`,
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
            <View>
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={16} color={CYAN} />
                <Text style={styles.locationTitle}> Ubicación</Text>
              </View>
              <Text style={styles.locationText}>Managua, Altamira</Text>
            </View>
            <View style={styles.logoCenter}>
              <TouchableOpacity
                activeOpacity={1}
                accessibilityLabel="CHAMBA"
              >
                <Text style={styles.logoText}>CHAMBA</Text>
              </TouchableOpacity>
            </View>
            <Avatar uri={profile?.avatar_url} name={profile?.full_name ?? firstName} size={36} />
          </View>

          <ChambaSlidingToggle<ActiveTab>
            options={[
              { id: 'hogar', label: 'Para tu Hogar' },
              { id: 'empresa', label: 'Para tu Negocio' },
            ]}
            active={activeTab}
            onChange={(id) => {
              setActiveTab(id);
              setSelectedExpressCat(null);
            }}
            style={styles.modeToggle}
          />

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
              <ClientHomeHeroCarousel slides={CLIENT_HOGAR_HERO_SLIDES} />

            <View style={styles.sectionHeader}>
              <View style={chambaStyles.sectionHeader}>
                <Text style={chambaStyles.sectionTitle}>
                  {'Servicios Express'}
                </Text>
                <Text style={chambaStyles.sectionSubtitle}>
                  {'Precio fijo, sin complicaciones'}
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
    backgroundColor: CHAMBA.bg,
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
    paddingHorizontal: 20,
  },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationTitle: { fontSize: 11, color: CHAMBA.muted },
  locationText: { fontSize: 13, fontWeight: '700', color: CHAMBA.navy },
  logoCenter: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  logoText: { fontSize: 20, fontWeight: '900', color: CHAMBA.teal, letterSpacing: 1 },
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

  modeToggle: { marginTop: 4, marginBottom: 16 },



  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  verTodos: { fontSize: 13, fontWeight: '600', color: BLUE },
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
    gap: 12,
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
