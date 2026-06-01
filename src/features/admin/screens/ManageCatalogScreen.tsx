import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@components/Input';
import { Button } from '@components/Button';
import { MaterialSymbol } from '@components/admin/MaterialSymbol';
import { useAuthStore } from '@store/authStore';
import { useCatalog, CATALOG_QUERY_KEY } from '@features/catalog/hooks/useCatalog';
import {
  adminUpsertCategory,
  adminUpsertServiceType,
  slugify,
} from '@features/admin/services/catalogAdminService';
import { showMessage } from '@utils/confirmAction';
import { M3, SPACING, BORDER_RADIUS, stitchTypography } from '@constants/stitchStyles';
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.md }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Catálogo dinámico</Text>
      <Text style={styles.subtitle}>
        Agrega categorías y tipos de trabajo sin actualizar la app.
      </Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialSymbol name="category" size={20} color={M3.primary} />
          <Text style={styles.cardTitle}>Agregar nueva categoría</Text>
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
          <MaterialSymbol name="handyman" size={20} color={M3.primary} />
          <Text style={styles.cardTitle}>Agregar nuevo trabajo</Text>
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
          <TouchableOpacity onPress={() => refetch()}>
            <MaterialSymbol name="refresh" size={22} color={M3.primary} />
          </TouchableOpacity>
        </View>
        {isLoading ? (
          <ActivityIndicator color={M3.primary} style={{ marginVertical: SPACING.lg }} />
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
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: M3.background },
  content: { padding: SPACING.lg, paddingBottom: 120 },
  title: { ...stitchTypography.headlineLg, color: M3.onBackground, marginBottom: 4 },
  subtitle: { color: M3.onSurfaceVariant, marginBottom: SPACING.lg, fontSize: 14 },
  card: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  cardTitle: { ...stitchTypography.headlineMd, color: M3.onBackground },
  fieldLabel: { color: M3.onSurfaceVariant, fontSize: 12, fontWeight: '600' },
  chipRow: { marginBottom: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: M3.surfaceContainerHigh,
    marginRight: 8,
  },
  chipActive: { backgroundColor: M3.primaryContainer },
  chipEmoji: { fontSize: 16 },
  chipText: { color: M3.onSurfaceVariant, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: M3.onPrimaryContainer },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listBlock: { marginTop: SPACING.sm },
  listCat: { fontWeight: '800', color: M3.onBackground, marginBottom: 4 },
  listItem: { color: M3.onSurfaceVariant, fontSize: 13, marginLeft: SPACING.sm, marginBottom: 2 },
});
