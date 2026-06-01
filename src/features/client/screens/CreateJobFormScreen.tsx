import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@store/authStore';
import { createJob } from '@features/jobs/services/jobsService';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/theme';
import { ScreenBackButton } from '@components/navigation/ScreenBackButton';
import { validateClientPrice } from '@constants/servicePricing';
import { formatCurrency } from '@utils/formatters';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import type { ClientStackParamList } from '@/types';

type Nav   = NativeStackNavigationProp<ClientStackParamList, 'CreateJobForm'>;
type Route = RouteProp<ClientStackParamList, 'CreateJobForm'>;

// ─── Labeled input ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  icon?: keyof typeof Ionicons.glyphMap;
}

const Field: React.FC<FieldProps> = ({ label, value, onChangeText, placeholder, multiline, keyboardType = 'default', icon }) => (
  <View style={fStyles.wrap}>
    <Text style={fStyles.label}>{label}</Text>
    <View style={[fStyles.inputRow, multiline && { alignItems: 'flex-start', height: 90 }]}>
      {icon && <Ionicons name={icon} size={18} color={COLORS.text.muted} style={fStyles.icon} />}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.text.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[fStyles.input, multiline && { height: 75, paddingTop: 4 }]}
      />
    </View>
  </View>
);

const fStyles = StyleSheet.create({
  wrap:     { marginBottom: SPACING.md },
  label:    { color: COLORS.text.primary, fontSize: FONT_SIZE.sm, fontWeight: '700', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border.subtle,
    paddingHorizontal: SPACING.md,
  },
  icon:  { marginRight: 8 },
  input: { flex: 1, color: COLORS.text.primary, fontSize: FONT_SIZE.md, paddingVertical: 13 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const CreateJobFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const insets     = useSafeAreaInsets();
  const profile    = useAuthStore((s) => s.profile);

  const serviceTypeSlug =
    route.params.serviceTypeSlug ?? route.params.clientCategory ?? '';
  const serviceLabel = route.params.serviceLabel;
  const catalog = useCatalog();
  const emoji  = catalog.getEmoji(serviceTypeSlug);
  const label  = catalog.getLabel(serviceTypeSlug) || serviceLabel;
  const priceLookup = {
    getSuggestedPrice: catalog.getSuggestedPrice,
    getMinPrice: catalog.getMinPrice,
  };

  const suggestedPrice = catalog.getSuggestedPrice(serviceTypeSlug);
  const minimumPrice   = catalog.getMinPrice(serviceTypeSlug);

  const [title,           setTitle]           = useState(`Solicitud: ${serviceLabel}`);
  const [description,     setDescription]     = useState('');
  const [address,         setAddress]         = useState('');
  const [budget,          setBudget]          = useState(String(suggestedPrice));
  const [durationHours,   setDurationHours]   = useState('2');
  const [requiredWorkers, setRequiredWorkers] = useState('1');
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [budgetError,     setBudgetError]     = useState<string | null>(null);

  const budgetAmount = Number(budget);
  const priceValidation = useMemo(
    () => (budget.trim() ? validateClientPrice(serviceTypeSlug, budgetAmount, priceLookup) : { valid: false, message: '' }),
    [serviceTypeSlug, budget, budgetAmount, catalog],
  );

  const canSubmit =
    title.trim() &&
    description.trim() &&
    address.trim() &&
    priceValidation.valid;

  const handleBudgetChange = (value: string) => {
    const cleaned = value.replace(/[^\d.]/g, '');
    setBudget(cleaned);
    if (!cleaned.trim()) {
      setBudgetError(null);
      return;
    }
    const result = validateClientPrice(serviceTypeSlug, Number(cleaned), priceLookup);
    setBudgetError(result.valid ? null : result.message);
  };

  const handleSubmit = async () => {
    if (!profile?.id || !canSubmit) return;

    const priceCheck = validateClientPrice(serviceTypeSlug, budgetAmount, priceLookup);
    if (!priceCheck.valid) {
      setBudgetError(priceCheck.message);
      if (Platform.OS === 'web') window.alert(priceCheck.message);
      else Alert.alert('Presupuesto inválido', priceCheck.message);
      return;
    }

    setIsSubmitting(true);
    try {
      await createJob({
        title:           title.trim(),
        description:     description.trim(),
        category:        serviceTypeSlug,
        payAmount:       budgetAmount,
        address:         address.trim(),
        lat:             12.1328,
        lng:             -86.2504,
        durationHours:   Number(durationHours) || 2,
        requiredWorkers: Number(requiredWorkers) || 1,
        createdBy:       profile.id,
      });

      const msg = '¡Tu solicitud fue enviada! Los trabajadores disponibles la verán pronto.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('¡Solicitud enviada!', msg, [{ text: 'OK' }]);
      }
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar';
      if (Platform.OS === 'web') window.alert(`Error: ${message}`);
      else Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <ScreenBackButton onPress={() => navigation.goBack()} color={COLORS.text.primary} />
        <Text style={styles.headerTitle}>Nueva Solicitud</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Category badge */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryEmoji}>{emoji}</Text>
          <View>
            <Text style={styles.categoryService}>{serviceLabel}</Text>
            <Text style={styles.categoryLabel}>{label}</Text>
          </View>
        </View>

        <Field label="Título de la solicitud" value={title} onChangeText={setTitle}
          placeholder="Ej. Limpieza de sofá y colchón" icon="create-outline" />
        <Field label="Descripción detallada" value={description} onChangeText={setDescription}
          placeholder="Describe qué necesitas, el estado actual, preferencias..."
          multiline icon="document-text-outline" />
        <Field label="Dirección del servicio" value={address} onChangeText={setAddress}
          placeholder="Ej. Semáforos de Rubenia 2c al norte" icon="location-outline" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Presupuesto (C$)" value={budget} onChangeText={handleBudgetChange}
              placeholder={String(suggestedPrice)} keyboardType="decimal-pad" icon="cash-outline" />
            <View style={styles.priceHintBox}>
              <Text style={styles.priceHint}>
                Precio sugerido: {formatCurrency(suggestedPrice)}
              </Text>
              <Text style={styles.priceHintMuted}>
                Mínimo permitido: {formatCurrency(minimumPrice)} (50% del sugerido)
              </Text>
              {budgetError ? (
                <Text style={styles.priceError}>{budgetError}</Text>
              ) : null}
            </View>
          </View>
          <View style={{ width: SPACING.md }} />
          <View style={{ flex: 1 }}>
            <Field label="Duración (horas)" value={durationHours} onChangeText={setDurationHours}
              placeholder="2" keyboardType="numeric" icon="time-outline" />
          </View>
        </View>

        <Field label="Trabajadores requeridos" value={requiredWorkers}
          onChangeText={setRequiredWorkers} placeholder="1"
          keyboardType="numeric" icon="people-outline" />

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.brand[500]} />
          <Text style={styles.infoText}>
            Tu solicitud será visible para trabajadores verificados de la categoría seleccionada.
            Recibirás notificación cuando alguien la acepte.
          </Text>
        </View>
      </ScrollView>

      {/* ── Submit ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          style={[styles.submitBtn, (!canSubmit || isSubmitting) && styles.submitBtnDisabled]}
          activeOpacity={0.85}
        >
          {isSubmitting
            ? <ActivityIndicator color="#FFF" />
            : <><Ionicons name="flash" size={20} color="#FFF" /><Text style={styles.submitBtnText}>Enviar Solicitud</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border.subtle,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: COLORS.text.primary, fontSize: FONT_SIZE.lg, fontWeight: '800' },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.brand[50], borderRadius: 16,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1.5, borderColor: COLORS.brand[200],
  },
  categoryEmoji:   { fontSize: 36 },
  categoryService: { color: COLORS.brand[700], fontSize: FONT_SIZE.md, fontWeight: '800' },
  categoryLabel:   { color: COLORS.brand[500], fontSize: FONT_SIZE.xs, fontWeight: '500' },
  row: { flexDirection: 'row' },
  priceHintBox: { marginTop: 6, gap: 2 },
  priceHint: { color: COLORS.brand[600], fontSize: FONT_SIZE.xs, fontWeight: '700' },
  priceHintMuted: { color: COLORS.text.muted, fontSize: FONT_SIZE.xs },
  priceError: { color: COLORS.error, fontSize: FONT_SIZE.xs, fontWeight: '600', marginTop: 2 },
  infoBox: {
    flexDirection: 'row', gap: SPACING.sm,
    backgroundColor: COLORS.brand[50], borderRadius: 12,
    padding: SPACING.md, marginTop: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.brand[100],
  },
  infoText: { color: COLORS.text.secondary, fontSize: FONT_SIZE.xs, flex: 1, lineHeight: 18 },
  footer: {
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md,
    backgroundColor: '#FFF', borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border.subtle,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.brand[500],
    borderRadius: BORDER_RADIUS.full, paddingVertical: 16,
    shadowColor: COLORS.brand[500], shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  submitBtnDisabled: { backgroundColor: COLORS.text.muted, shadowOpacity: 0 },
  submitBtnText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '800' },
});
