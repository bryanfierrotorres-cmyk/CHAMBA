import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@components/Input';
import { Button } from '@components/Button';
import { ServiceCatalogGroups } from '@components/catalog/ServiceCatalogGroups';
import { useAuthStore } from '@store/authStore';
import { useCatalog, CATALOG_QUERY_KEY } from '@features/catalog/hooks/useCatalog';
import { PRECIOS_CATALOG_QUERY_KEY } from '@features/catalog/hooks/usePreciosCatalog';
import { adminUpsertPreciosBatch } from '@features/catalog/services/preciosCatalogService';
import {
  adminUpsertCategory,
  adminUpsertServiceType,
  slugify,
} from '@features/admin/operational/services/catalogAdminService';
import { showMessage } from '@utils/confirmAction';
import { resolveAdminActorProfile } from '@utils/profileSync';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import type { ServiceCategory } from '@features/catalog/types';

export const ManageCatalogScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const {
    categories,
    serviceTypes,
    isLoading,
    preciosSource,
    preciosDbRowCount,
  } = useCatalog();

  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📋');
  const [catSlug, setCatSlug] = useState('');

  const [typeName, setTypeName] = useState('');
  const [typeIcon, setTypeIcon] = useState('🔧');
  const [typeSlug, setTypeSlug] = useState('');
  const [typePrice, setTypePrice] = useState('');
  const [typeDesc, setTypeDesc] = useState('');
  const [typeCategorySlug, setTypeCategorySlug] = useState('');

  const baselinePrices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of serviceTypes) {
      map[t.slug] = Math.round(Number(t.suggested_price) || 0);
    }
    return map;
  }, [serviceTypes]);

  useEffect(() => {
    if (isLoading || serviceTypes.length === 0) return;
    setPriceDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const t of serviceTypes) {
        const baseline = baselinePrices[t.slug] ?? 0;
        next[t.slug] = prev[t.slug] ?? String(baseline);
      }
      return next;
    });
  }, [serviceTypes, isLoading, baselinePrices]);

  const handlePriceChange = useCallback((slug: string, value: string) => {
    setPriceDrafts((prev) => ({ ...prev, [slug]: value }));
  }, []);

  const modifiedSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const t of serviceTypes) {
      const raw = priceDrafts[t.slug] ?? '';
      const draft = parseFloat(raw);
      const baseline = baselinePrices[t.slug] ?? 0;
      if (!Number.isFinite(draft) || draft < 0) continue;
      if (Math.round(draft) !== Math.round(baseline)) {
        set.add(t.slug);
      }
    }
    return set;
  }, [serviceTypes, priceDrafts, baselinePrices]);

  const invalidateCatalog = () => {
    void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: PRECIOS_CATALOG_QUERY_KEY });
  };

  const savePrecios = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Sesión de administrador requerida');
      if (modifiedSlugs.size === 0) throw new Error('No hay cambios para guardar');

      const rows = [...modifiedSlugs].map((slug) => {
        const price = parseFloat(priceDrafts[slug] ?? '');
        if (!Number.isFinite(price) || price < 0) {
          throw new Error(`Precio inválido para ${slug}`);
        }
        return { service_slug: slug, suggested_price: price };
      });

      const adminProfile = await resolveAdminActorProfile(profile);
      const result = await adminUpsertPreciosBatch(adminProfile.id, rows);
      if (!result.success) throw new Error(result.error ?? 'No se pudieron guardar los precios');
      return result;
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PRECIOS_CATALOG_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY }),
      ]);
      await queryClient.refetchQueries({ queryKey: PRECIOS_CATALOG_QUERY_KEY });
      showMessage(
        'Precios actualizados',
        `Se guardaron ${result.updated ?? modifiedSlugs.size} precio(s) en la base de datos.`,
      );
    },
    onError: (e: Error) => showMessage('Error', e.message),
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Sesión de administrador requerida');
      const adminProfile = await resolveAdminActorProfile(profile);
      const slug = catSlug.trim() || slugify(catName);
      if (!catName.trim() || !slug) throw new Error('Nombre de categoría requerido');
      return adminUpsertCategory(adminProfile.id, {
        slug,
        name: catName.trim(),
        icon: catIcon.trim() || '📋',
      });
    },
    onSuccess: () => {
      setCatName('');
      setCatSlug('');
      setCatIcon('📋');
      invalidateCatalog();
      showMessage('Listo', 'Categoría guardada');
    },
    onError: (e: Error) => showMessage('Error', e.message),
  });

  const addServiceType = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Sesión de administrador requerida');
      const adminProfile = await resolveAdminActorProfile(profile);
      const slug = typeSlug.trim() || slugify(typeName);
      const price = parseFloat(typePrice) || 0;
      if (!typeName.trim() || !slug) throw new Error('Nombre del trabajo requerido');
      if (!typeCategorySlug) throw new Error('Selecciona una categoría');
      return adminUpsertServiceType(adminProfile.id, {
        categorySlug: typeCategorySlug,
        slug,
        name: typeName.trim(),
        icon: typeIcon.trim() || '🔧',
        description: typeDesc.trim() || undefined,
        suggestedPrice: price,
      });
    },
    onSuccess: () => {
      setTypeName('');
      setTypeSlug('');
      setTypeIcon('🔧');
      setTypePrice('');
      setTypeDesc('');
      invalidateCatalog();
      showMessage('Listo', 'Trabajo / servicio guardado');
    },
    onError: (e: Error) => showMessage('Error', e.message),
  });

  const preciosHint = preciosSource === 'database'
    ? `${preciosDbRowCount} precio(s) en base de datos · resto desde respaldo local`
    : 'Precios desde respaldo local (servicesConfig.ts) hasta que guardes cambios';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (modifiedSlugs.size > 0 ? 120 : 48) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={chambaStyles.screenHeader}>
          <Text style={chambaStyles.screenTitle}>Catálogo y precios</Text>
          <Text style={chambaStyles.screenSubtitle}>
            Editá el precio sugerido por servicio, cambiá el monto y tocá Guardar cambios.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[chambaStyles.iconCircleRight, { backgroundColor: CHAMBA.blue }]}>
              <Ionicons name="pricetag" size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Precios sugeridos</Text>
              <Text style={styles.cardHint}>{preciosHint}</Text>
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator color={CHAMBA.blue} style={{ marginVertical: 24 }} />
          ) : (
            <ServiceCatalogGroups
              accordion
              compact
              editablePrices
              priceValues={priceDrafts}
              onPriceChange={handlePriceChange}
              modifiedSlugs={modifiedSlugs}
            />
          )}
        </View>

        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced((v) => !v)}
          accessibilityRole="button"
        >
          <Text style={styles.advancedToggleText}>
            {showAdvanced ? 'Ocultar' : 'Mostrar'} opciones avanzadas
          </Text>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={CHAMBA.muted}
          />
        </TouchableOpacity>

        {showAdvanced ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[chambaStyles.iconCircleRight, { backgroundColor: '#5856D6' }]}>
                  <Ionicons name="grid" size={22} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Agregar nueva categoría</Text>
                  <Text style={styles.cardHint}>Organizá los servicios por rubro</Text>
                </View>
              </View>
              <Input
                label="Nombre"
                value={catName}
                onChangeText={(t) => { setCatName(t); if (!catSlug) setCatSlug(slugify(t)); }}
                placeholder="Ej. Limpieza"
              />
              <Input
                label="Slug (ID interno)"
                value={catSlug}
                onChangeText={setCatSlug}
                placeholder="limpieza"
                autoCapitalize="none"
              />
              <Input
                label="Ícono (emoji)"
                value={catIcon}
                onChangeText={setCatIcon}
                placeholder="📋"
              />
              <Button
                label={addCategory.isPending ? 'Guardando…' : 'Guardar categoría'}
                onPress={() => addCategory.mutate()}
                isLoading={addCategory.isPending}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[chambaStyles.iconCircleRight, { backgroundColor: '#FF9500' }]}>
                  <Ionicons name="construct" size={22} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Agregar nuevo trabajo</Text>
                  <Text style={styles.cardHint}>Servicios visibles en la app cliente</Text>
                </View>
              </View>
              <Text style={styles.fieldLabel}>Categoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {categories.map((c: ServiceCategory) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, typeCategorySlug === c.slug && styles.chipActive]}
                    onPress={() => setTypeCategorySlug(c.slug)}
                  >
                    <Text style={styles.chipEmoji}>{c.icon}</Text>
                    <Text style={[styles.chipText, typeCategorySlug === c.slug && styles.chipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Input
                label="Nombre del servicio"
                value={typeName}
                onChangeText={(t) => { setTypeName(t); if (!typeSlug) setTypeSlug(slugify(t)); }}
                placeholder="Ej. Limpieza de Sofás"
              />
              <Input label="Slug" value={typeSlug} onChangeText={setTypeSlug} autoCapitalize="none" />
              <Input label="Ícono" value={typeIcon} onChangeText={setTypeIcon} placeholder="🛋️" />
              <Input
                label="Precio sugerido (C$)"
                value={typePrice}
                onChangeText={setTypePrice}
                keyboardType="numeric"
                placeholder="1400"
              />
              <Input
                label="Descripción (opcional)"
                value={typeDesc}
                onChangeText={setTypeDesc}
                multiline
              />
              <Button
                label={addServiceType.isPending ? 'Guardando…' : 'Guardar trabajo'}
                onPress={() => addServiceType.mutate()}
                isLoading={addServiceType.isPending}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      {modifiedSlugs.size > 0 ? (
        <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.saveBarInner}>
            <View style={styles.saveBarTextWrap}>
              <Text style={styles.saveBarTitle}>
                {modifiedSlugs.size} cambio{modifiedSlugs.size === 1 ? '' : 's'} pendiente{modifiedSlugs.size === 1 ? '' : 's'}
              </Text>
              <Text style={styles.saveBarHint}>Se guardará en Supabase (precios_catalogo)</Text>
            </View>
            <Button
              label={savePrecios.isPending ? 'Guardando…' : 'Guardar cambios'}
              onPress={() => savePrecios.mutate()}
              isLoading={savePrecios.isPending}
              style={styles.saveBarButton}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    gap: 12,
    ...CARD_STEP_SHADOW,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy },
  cardHint: { fontSize: 13, color: CHAMBA.muted, fontWeight: '400', marginTop: 2 },
  fieldLabel: { color: CHAMBA.muted, fontSize: 12, fontWeight: '600' },
  chipRow: { marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFF2F9',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#E0F2FE' },
  chipEmoji: { fontSize: 16 },
  chipText: { color: CHAMBA.muted, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: CHAMBA.blue },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  advancedToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: CHAMBA.muted,
  },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CHAMBA.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    ...CARD_STEP_SHADOW,
  },
  saveBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveBarTextWrap: { flex: 1, minWidth: 0 },
  saveBarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  saveBarHint: {
    fontSize: 11,
    color: CHAMBA.muted,
    marginTop: 2,
  },
  saveBarButton: { minWidth: 140 },
});
