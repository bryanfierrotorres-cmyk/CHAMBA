/**
 * WorkerOnboardingScreen
 * Shown to workers whose profile is incomplete (no cedula_url / record_policia_url).
 * Steps:
 *   1. Upload cédula photo
 *   2. Upload récord de policía
 *   3. Select 1 primary specialty (auto-approved) + optional 2nd specialty (pending)
 *   4. Submit → status = 'pending_approval' in Supabase
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@services/supabase';
import { uploadWorkerDocument } from '../services/documentUploadService';
import { showMessage } from '@utils/confirmAction';
import { useAuthStore } from '@store/authStore';
import { WORKER_COLORS as COLORS, M3, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/workerTheme';
import { CHAMBA_CATEGORIES, CATEGORY_LABELS } from '@constants/chambaCategories';
import type { JobCategory } from '@constants/chambaCategories';

// ─── Category picker ──────────────────────────────────────────────────────────

const ALL_CATEGORIES = CHAMBA_CATEGORIES.map((c) => [c.id, c.label] as [JobCategory, string]);

const CATEGORY_ICONS: Record<JobCategory, keyof typeof Ionicons.glyphMap> = {
  limpieza_sofas:          'bed-outline',
  limpieza_alfombra:       'layers-outline',
  alfombra_institucional:  'business-outline',
  fumigacion:              'bug-outline',
  vehiculo_profundo:       'car-outline',
  conserjeria_ocasional:   'time-outline',
  conserjeria_contrato:    'document-text-outline',
  jardineria:              'leaf-outline',
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const StepDot: React.FC<{ n: number; active: boolean; done: boolean }> = ({ n, active, done }) => (
  <View style={[sDot.dot, active && sDot.dotActive, done && sDot.dotDone]}>
    {done
      ? <Ionicons name="checkmark" size={12} color="#FFF" />
      : <Text style={[sDot.label, (active || done) && { color: '#FFF' }]}>{n}</Text>}
  </View>
);

const sDot = StyleSheet.create({
  dot:       { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.border.default, alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: COLORS.brand[500] },
  dotDone:   { backgroundColor: COLORS.success },
  label:     { color: COLORS.text.muted, fontSize: FONT_SIZE.xs, fontWeight: '700' },
});

// ─── File upload button ───────────────────────────────────────────────────────

interface UploadBtnProps {
  label:    string;
  sublabel: string;
  icon:     keyof typeof Ionicons.glyphMap;
  uri:      string | null;
  onPick:   () => void;
  uploading:boolean;
}

const UploadBtn: React.FC<UploadBtnProps> = ({ label, sublabel, icon, uri, onPick, uploading }) => (
  <TouchableOpacity style={[uBtn.wrap, uri ? uBtn.wrapDone : null]} onPress={onPick} activeOpacity={0.8}>
    <View style={[uBtn.iconCircle, uri ? uBtn.iconCircleDone : null]}>
      {uri ? (
        <Image source={{ uri }} style={uBtn.preview} resizeMode="cover" />
      ) : uploading ? (
        <ActivityIndicator size="small" color={COLORS.brand[500]} />
      ) : (
        <Ionicons name={icon} size={28} color={COLORS.brand[500]} />
      )}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={uBtn.label}>{label}</Text>
      <Text style={uBtn.sub}>{uri ? '✓ Archivo cargado' : sublabel}</Text>
    </View>
    <Ionicons name={uri ? 'checkmark' : 'chevron-forward'} size={18} color={uri ? COLORS.success : COLORS.text.muted} />
  </TouchableOpacity>
);

const uBtn = StyleSheet.create({
  wrap:           { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: '#FFF', borderRadius: 16, padding: SPACING.md, borderWidth: 1.5, borderColor: COLORS.border.subtle, marginBottom: SPACING.sm },
  wrapDone:       { borderColor: COLORS.success + '80', backgroundColor: '#F0FDF4' },
  iconCircle:     { width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.brand[50], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconCircleDone: { backgroundColor: COLORS.success },
  preview:        { width: 52, height: 52, borderRadius: 14 },
  label:          { color: COLORS.text.primary, fontWeight: '700', fontSize: FONT_SIZE.sm },
  sub:            { color: COLORS.text.muted, fontSize: FONT_SIZE.xs, marginTop: 2 },
});

// ─── Category chip ────────────────────────────────────────────────────────────

const CatChip: React.FC<{
  cat: JobCategory; label: string; selected: boolean; disabled?: boolean; onPress: () => void;
}> = ({ cat, label, selected, disabled, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.8}
    style={[chip.wrap, selected && chip.wrapSel, disabled && chip.wrapDisabled]}
  >
    <Ionicons
      name={CATEGORY_ICONS[cat]}
      size={16}
      color={selected ? '#FFF' : disabled ? COLORS.text.muted : COLORS.brand[500]}
    />
    <Text style={[chip.label, selected && chip.labelSel, disabled && chip.labelDisabled]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const chip = StyleSheet.create({
  wrap:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BORDER_RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border.subtle, backgroundColor: '#FFF', margin: 4 },
  wrapSel:      { backgroundColor: COLORS.brand[500], borderColor: COLORS.brand[500] },
  wrapDisabled: { opacity: 0.45 },
  label:        { color: COLORS.text.primary, fontSize: FONT_SIZE.xs, fontWeight: '600' },
  labelSel:     { color: '#FFF' },
  labelDisabled:{ color: COLORS.text.muted },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const WorkerOnboardingScreen: React.FC = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const profile    = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  // True when accessed via navigation (has back stack), false when gating entry
  const canGoBack  = navigation.canGoBack();

  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Docs
  const [cedulaUri,   setCedulaUri]   = useState<string | null>(null);
  const [recordUri,   setRecordUri]   = useState<string | null>(null);
  const [uploadingC,  setUploadingC]  = useState(false);
  const [uploadingR,  setUploadingR]  = useState(false);
  const [cedulaUrl,   setCedulaUrl]   = useState<string | null>(null);
  const [recordUrl,   setRecordUrl]   = useState<string | null>(null);

  // Specialties
  const [cat1, setCat1] = useState<JobCategory | null>(null);
  const [cat2, setCat2] = useState<JobCategory | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (profile.cedula_url && profile.cedula_url !== 'pilot-bypass') {
      setCedulaUrl(profile.cedula_url);
      setCedulaUri(profile.cedula_url);
    }
    if (profile.record_policia_url && profile.record_policia_url !== 'pilot-bypass') {
      setRecordUrl(profile.record_policia_url);
      setRecordUri(profile.record_policia_url);
    }
    if (profile.category_1) setCat1(profile.category_1 as JobCategory);
    if (profile.category_2) setCat2(profile.category_2 as JobCategory);
  }, [profile?.id]);

  // ── Pickers ───────────────────────────────────────────────────

  const pickCedula = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (res.canceled || !res.assets[0]) return;
    if (!profile?.id) {
      Alert.alert('Error', 'Sesión inválida. Vuelve a iniciar sesión.');
      return;
    }

    const uri = res.assets[0].uri;
    setCedulaUri(uri);
    setUploadingC(true);
    try {
      const url = await uploadWorkerDocument(profile.id, uri, 'cedula');
      setCedulaUrl(url);
      setCedulaUri(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      if (Platform.OS === 'web') showMessage('Error', `No se pudo subir la cédula: ${msg}`);
      else Alert.alert('Error', `No se pudo subir la cédula: ${msg}`);
      setCedulaUri(null);
      setCedulaUrl(null);
    } finally {
      setUploadingC(false);
    }
  };

  const pickRecord = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (res.canceled || !res.assets[0]) return;
    if (!profile?.id) {
      Alert.alert('Error', 'Sesión inválida. Vuelve a iniciar sesión.');
      return;
    }

    const uri = res.assets[0].uri;
    setRecordUri(uri);
    setUploadingR(true);
    try {
      const url = await uploadWorkerDocument(profile.id, uri, 'record_policia');
      setRecordUrl(url);
      setRecordUri(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      if (Platform.OS === 'web') showMessage('Error', `No se pudo subir el récord: ${msg}`);
      else Alert.alert('Error', `No se pudo subir el récord: ${msg}`);
      setRecordUri(null);
      setRecordUrl(null);
    } finally {
      setUploadingR(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!cat1) {
      Alert.alert('Especialidad requerida', 'Selecciona al menos una especialidad principal.');
      return;
    }
    if (!cedulaUrl || !recordUrl) {
      Alert.alert('Documentos requeridos', 'Sube ambos documentos antes de continuar.');
      return;
    }

    setLoading(true);
    try {
      const updates = {
        cedula_url:          cedulaUrl,
        record_policia_url:  recordUrl,
        worker_status:       'pending_approval' as const,
        category_1:          cat1,
        category_2:          cat2 ?? null,
        category_1_approved: true,
        category_2_approved: false,
      };

      // Try to persist in Supabase; if RLS blocks it, fall back to local store only
      const { error: updateErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile!.id);

      if (updateErr) {
        console.warn('[Onboarding] Supabase update blocked, saving locally:', updateErr.message);
      }

      // Always update local store + AsyncStorage so the admin modal can read docs
      const updatedProfile = { ...profile!, ...updates };
      setProfile(updatedProfile);

      // Persist to AsyncStorage for phone-auth users
      await AsyncStorage.setItem('CHAMBA_PILOT_PROFILE', JSON.stringify(updatedProfile));

      const msg = 'Tus documentos fueron enviados. El administrador los revisará pronto.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('¡Enviado!', msg);
    } catch (e: any) {
      const msg = e.message ?? 'No se pudo enviar. Intenta de nuevo.';
      if (Platform.OS === 'web') window.alert(`Error: ${msg}`);
      else Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Steps ─────────────────────────────────────────────────────

  const canGoStep2 = !!cedulaUrl && !!recordUrl;
  const canGoStep3 = canGoStep2;
  const canSubmit  = canGoStep2 && !!cat1;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {canGoBack && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.logoRow}>
          <Ionicons name="flash" size={22} color={COLORS.brand[500]} />
          <Text style={styles.appName}>CHAMBA</Text>
        </View>
        <Text style={styles.headerTitle}>
          {canGoBack ? 'Actualizar Documentos' : 'Configura tu perfil'}
        </Text>
        <Text style={styles.headerSub}>
          {canGoBack
            ? 'Actualiza tus documentos y especialidades'
            : 'Solo toma 2 minutos · Necesario para chambear'}
        </Text>

        {/* Step indicators */}
        <View style={styles.steps}>
          {([1, 2, 3] as const).map((n, i) => (
            <React.Fragment key={n}>
              <StepDot n={n} active={step === n} done={step > n} />
              {i < 2 && (
                <View style={[styles.stepLine, step > n && styles.stepLineDone]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── STEP 1: Documents ── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>📄 Documentos de Seguridad</Text>
            <Text style={styles.stepDesc}>
              Necesitamos verificar tu identidad antes de que puedas ver y aceptar chambas.
              Tus documentos se guardan de forma segura y solo los ve el administrador.
            </Text>

            <UploadBtn
              label="Foto de Cédula"
              sublabel="Toca para seleccionar imagen"
              icon="card-outline"
              uri={cedulaUri}
              onPick={pickCedula}
              uploading={uploadingC}
            />
            <UploadBtn
              label="Récord de Policía"
              sublabel="Toca para seleccionar imagen"
              icon="shield-checkmark-outline"
              uri={recordUri}
              onPick={pickRecord}
              uploading={uploadingR}
            />

            <View style={styles.infoBox}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.brand[400]} />
              <Text style={styles.infoText}>
                Tus documentos se almacenan con cifrado y solo el equipo de CHAMBA puede verlos.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setStep(2)}
              disabled={!canGoStep2}
              style={[styles.nextBtn, !canGoStep2 && styles.nextBtnDisabled]}
            >
              <Text style={styles.nextBtnText}>Siguiente →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Especialidades ── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>⭐ Especialidad Principal</Text>
            <Text style={styles.stepDesc}>
              Elige el servicio que mejor dominas. Esta categoría se aprueba{' '}
              <Text style={{ fontWeight: '800', color: COLORS.success }}>instantáneamente</Text>{' '}
              una vez el admin apruebe tu perfil.
            </Text>

            <View style={styles.chipWrap}>
              {ALL_CATEGORIES.map(([cat, label]) => (
                <CatChip
                  key={cat}
                  cat={cat}
                  label={label}
                  selected={cat1 === cat}
                  onPress={() => {
                    setCat1((prev) => prev === cat ? null : cat);
                    if (cat2 === cat) setCat2(null);
                  }}
                />
              ))}
            </View>

            <Text style={[styles.stepTitle, { marginTop: SPACING.lg }]}>➕ Segunda Especialidad (Opcional)</Text>
            <Text style={styles.stepDesc}>
              Puedes ganar más con una segunda categoría. Queda en estado{' '}
              <Text style={{ fontWeight: '800', color: COLORS.warning }}>pendiente</Text>{' '}
              hasta que el admin la autorice por separado.
            </Text>

            <View style={styles.chipWrap}>
              {ALL_CATEGORIES.map(([cat, label]) => (
                <CatChip
                  key={cat}
                  cat={cat}
                  label={label}
                  selected={cat2 === cat}
                  disabled={cat1 === cat}
                  onPress={() => setCat2((prev) => prev === cat ? null : cat)}
                />
              ))}
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.navBackBtn}>
                <Text style={styles.backBtnText}>← Atrás</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(3)}
                disabled={!cat1}
                style={[styles.nextBtn, { flex: 1 }, !cat1 && styles.nextBtnDisabled]}
              >
                <Text style={styles.nextBtnText}>Siguiente →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP 3: Confirm & Submit ── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>✅ Todo listo</Text>
            <Text style={styles.stepDesc}>
              Revisa tu información y envía para que el equipo de CHAMBA revise tu solicitud.
              Recibirás una notificación cuando seas aprobado.
            </Text>

            {/* Summary card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Ionicons name="card-outline" size={18} color={COLORS.brand[500]} />
                <Text style={styles.summaryLabel}>Cédula</Text>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.brand[500]} />
                <Text style={styles.summaryLabel}>Récord de Policía</Text>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
              </View>
              <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                <Ionicons name={CATEGORY_ICONS[cat1!]} size={18} color={COLORS.brand[500]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>{CATEGORY_LABELS[cat1!]}</Text>
                  <Text style={[styles.summaryMeta, { color: COLORS.success }]}>✓ Aprobación instantánea</Text>
                </View>
              </View>
              {cat2 && (
                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Ionicons name={CATEGORY_ICONS[cat2]} size={18} color={COLORS.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryLabel}>{CATEGORY_LABELS[cat2]}</Text>
                    <Text style={[styles.summaryMeta, { color: COLORS.warning }]}>⏳ Requiere aprobación del admin</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="time-outline" size={16} color={COLORS.brand[400]} />
              <Text style={styles.infoText}>
                El tiempo de revisión es de 24–48 horas hábiles. Mientras tanto puedes actualizar tu perfil.
              </Text>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep(2)} style={styles.navBackBtn}>
                <Text style={styles.backBtnText}>← Atrás</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading || !canSubmit}
                style={[styles.nextBtn, { flex: 1, backgroundColor: COLORS.success }, (loading || !canSubmit) && styles.nextBtnDisabled]}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.nextBtnText}>Enviar solicitud ⚡</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg.primary },

  header: {
    backgroundColor: COLORS.bg.navy, padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  appName: { color: '#FFF', fontWeight: '900', fontSize: FONT_SIZE.lg, letterSpacing: 2 },
  headerTitle: { color: '#FFF', fontSize: FONT_SIZE['2xl'], fontWeight: '900' },
  headerSub:   { color: 'rgba(255,255,255,0.65)', fontSize: FONT_SIZE.sm, marginTop: 4, marginBottom: SPACING.lg },

  steps:       { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepLine:    { flex: 1, height: 2, backgroundColor: COLORS.border.default, marginHorizontal: 4 },
  stepLineDone:{ backgroundColor: COLORS.success },

  scroll: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },

  stepTitle: { color: COLORS.text.primary, fontSize: FONT_SIZE.lg, fontWeight: '800', marginBottom: 8 },
  stepDesc:  { color: COLORS.text.secondary, fontSize: FONT_SIZE.sm, lineHeight: 20, marginBottom: SPACING.lg },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.brand[50], borderRadius: 12,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.brand[100],
  },
  infoText: { color: COLORS.text.secondary, fontSize: FONT_SIZE.xs, flex: 1, lineHeight: 18 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.sm },

  navRow:  { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  navBackBtn: {
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
    borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.bg.card,
    borderWidth: 1, borderColor: COLORS.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: COLORS.text.primary, fontWeight: '700', fontSize: FONT_SIZE.sm },

  nextBtn: {
    backgroundColor: COLORS.brand[500], borderRadius: BORDER_RADIUS.full,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  nextBtnDisabled: { backgroundColor: COLORS.border.default, shadowOpacity: 0 },
  nextBtnText:     { color: '#FFF', fontWeight: '800', fontSize: FONT_SIZE.md },

  summaryCard: {
    backgroundColor: '#FFF', borderRadius: 16, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border.subtle,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border.subtle,
  },
  summaryLabel: { flex: 1, color: COLORS.text.primary, fontWeight: '600', fontSize: FONT_SIZE.sm },
  summaryMeta:  { fontSize: FONT_SIZE.xs, marginTop: 2 },
});
