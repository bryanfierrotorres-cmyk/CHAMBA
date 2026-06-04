import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@components/Input';
import { Button } from '@components/Button';
import { useAuthStore } from '@store/authStore';
import { useCatalog, CATALOG_QUERY_KEY } from '@features/catalog/hooks/useCatalog';
import {
  adminUpsertCategory,
  adminUpsertServiceType,
  slugify,
} from '@features/admin/services/catalogAdminService';
import { showMessage } from '@utils/confirmAction';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import type { ServiceCategory, ServiceType } from '@features/catalog/types';

export const ManageCatalogScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const { categories, serviceTypes, isLoading, refetch } = useCatalog();

  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📋');
  const [catSlug, setCatSlug] = useState('');

  const [typeName, setTypeName] = useState('');
  const [typeIcon, setTypeIcon] = useState('🔧');
  const [typeSlug, setTypeSlug] = useState('');
  const [typePrice, setTypePrice] = useState('');
  const [typeDesc, setTypeDesc] = useState('');
  const [typeCategorySlug, setTypeCategorySlug] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });

  const addCategory = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Sesión de administrador requerida');
      const slug = catSlug.trim() || slugify(catName);
      if (!catName.trim() || !slug) throw new Error('Nombre de categoría requerido');
      return adminUpsertCategory(profile.id, {
        slug,
        name: catName.trim(),
        icon: catIcon.trim() || '📋',
      });
    },
    onSuccess: () => {
      setCatName('');
      setCatSlug('');
      setCatIcon('📋');
      invalidate();
      showMessage('Listo', 'Categoría guardada');
    },
    onError: (e: Error) => showMessage('Error', e.message),
  });

  const addServiceType = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Sesión de administrador requerida');
      const slug = typeSlug.trim() || slugify(typeName);
      const price = parseFloat(typePrice) || 0;
      if (!typeName.trim() || !slug) throw new Error('Nombre del trabajo requerido');
      if (!typeCategorySlug) throw new Error('Selecciona una categoría');
      return adminUpsertServiceType(profile.id, {
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
      invalidate();
      showMessage('Listo', 'Trabajo / servicio guardado');
    },
    onError: (e: Error) => showMessage('Error', e.message),
  });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={chambaStyles.screenHeader}>
        <Text style={chambaStyles.screenTitle}>Catálogo dinámico</Text>
        <Text style={chambaStyles.screenSubtitle}>
          Agregá categorías y tipos de trabajo sin actualizar la app.
        </Text>
      </View>

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

      <View style={styles.card}>
        <View style={styles.listHeader}>
          <Text style={styles.cardTitle}>Catálogo activo</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.refreshOrb}>
            <Ionicons name="refresh" size={20} color={CHAMBA.blue} />
          </TouchableOpacity>
        </View>
        {isLoading ? (
          <ActivityIndicator color={CHAMBA.blue} style={{ marginVertical: 20 }} />
        ) : (
          categories.map((cat: ServiceCategory) => (
            <View key={cat.id} style={styles.listBlock}>
              <Text style={styles.listCat}>{cat.icon} {cat.name}</Text>
              {serviceTypes
                .filter((t: ServiceType) => t.category_slug === cat.slug)
                .map((t: ServiceType) => (
                  <Text key={t.id} style={styles.listItem}>
                    {t.icon} {t.name} — C${t.suggested_price}
                  </Text>
                ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
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
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refreshOrb: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#EFF2F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  listCat: { fontWeight: '600', color: CHAMBA.navy, marginBottom: 4, fontSize: 15 },
  listItem: { color: CHAMBA.muted, fontSize: 13, marginLeft: 8, marginBottom: 2, fontWeight: '400' },
});
