import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { createJob } from '@features/jobs/services/jobsService';
import { useAuthStore } from '@store/authStore';
import { JOB_KEYS } from '@features/jobs/hooks/useJobs';
import { validateJobForm } from '@utils/validation';
import { formatCurrency } from '@utils/formatters';
import { showMessage } from '@utils/confirmAction';
import { ensureProfileInDb } from '@utils/profileSync';
import { CONFIG } from '@constants/config';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import type { ServiceType } from '@features/catalog/types';
import type { JobCategory } from '@/types';
import { CHAMBA_DEPARTMENTS, DEPARTMENT_COORDS, type ChambaDepartment } from '@constants/departments';
import { formatJobAddress } from '@utils/locationFormat';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import {
  buildGroupedServiceTypes,
  DEFAULT_SERVICE_SLUG,
} from '@constants/servicesConfig';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const serviceTypeAccent = (slug: string, categorySlug: string): string => {
  const s = slug.toLowerCase();
  const c = categorySlug.toLowerCase();
  if (s.includes('sofa') || s.includes('limpieza') || c.includes('limpieza')) return '#5856D6';
  if (s.includes('vehiculo') || s.includes('car') || c.includes('vehiculo')) return '#007AFF';
  if (s.includes('jardiner') || c.includes('jardiner')) return '#34C759';
  if (s.includes('electric')) return '#FFCC00';
  if (s.includes('plom')) return '#0EA5E9';
  if (s.includes('pet')) return '#FF9500';
  return '#FF9500';
};

// ─── Section (Consola No-Code) ────────────────────────────────────────────────

const ConsoleSection: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
  bare?: boolean;
}> = ({ label, hint, children, bare }) => (
  <View style={styles.consoleSection}>
    <Text style={chambaStyles.sectionTitle}>{label}</Text>
    {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    {bare ? children : <View style={styles.ambientCard}>{children}</View>}
  </View>
);

const ServiceTypeRow: React.FC<{
  serviceType: ServiceType;
  active: boolean;
  onPress: () => void;
}> = ({ serviceType, active, onPress }) => {
  const accent = serviceTypeAccent(serviceType.slug, serviceType.category_slug);
  const subtitle = serviceType.description?.trim() || 'Servicio disponible en el radar';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[styles.typeRow, active && styles.typeRowActive]}
    >
      <View style={chambaStyles.stepCardContent}>
        <Text style={[chambaStyles.cardTitle, active && styles.typeTitleActive]} numberOfLines={2}>
          {serviceType.name}
        </Text>
        <Text style={[chambaStyles.cardSubtitle, active && styles.typeSubtitleActive]} numberOfLines={2}>
          {subtitle}
        </Text>
        {serviceType.suggested_price > 0 && (
          <Text style={[styles.typePrice, active && styles.typePriceActive]}>
            {formatCurrency(serviceType.suggested_price)}
          </Text>
        )}
      </View>
      <View style={[chambaStyles.iconCircleRight, { backgroundColor: active ? CHAMBA.cyan : accent }]}>
        {active
          ? <Ionicons name="checkmark" size={22} color="#FFF" />
          : <Text style={styles.typeEmoji}>{serviceType.icon}</Text>}
      </View>
    </TouchableOpacity>
  );
};

const PayRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
  large?: boolean;
}> = ({ label, value, valueColor = CHAMBA.navy, bold = false, large = false }) => (
  <View style={styles.payRow}>
    <Text style={[styles.payLabel, large && { fontSize: 16 }]}>{label}</Text>
    <Text style={[
      styles.payValue,
      { color: valueColor, fontWeight: bold ? '600' : '400', fontSize: large ? 20 : 15 },
    ]}>
      {value}
    </Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const CreateJobScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const insets      = useSafeAreaInsets();
  const profile     = useAuthStore((s) => s.profile);
  const { serviceTypes, isLoading: catalogLoading } = useCatalog();

  const groupedServiceTypes = useMemo(
    () => buildGroupedServiceTypes(serviceTypes),
    [serviceTypes],
  );

  const handleSelectServiceType = (st: ServiceType) => {
    setCategory(st.slug);
    if (st.suggested_price > 0) {
      setPayAmount(String(st.suggested_price));
    }
  };

  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory]       = useState<JobCategory>(DEFAULT_SERVICE_SLUG);
  const [payAmount, setPayAmount]     = useState('');
  const [department, setDepartment]   = useState<ChambaDepartment>('Managua');
  const [addressDetail, setAddressDetail] = useState('');
  const [durationHours, setDuration]  = useState('4');
  const [requiredWorkers, setWorkers] = useState('1');
  const [error, setError]             = useState('');
  const [published, setPublished]     = useState(false);

  const pay    = parseFloat(payAmount) || 0;
  const fee    = parseFloat((pay * CONFIG.platform.commissionRate).toFixed(2));
  const payout = parseFloat((pay * CONFIG.platform.workerPayoutRate).toFixed(2));

  const { mutateAsync: publish, isPending } = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOB_KEYS.all });
      setPublished(true);
      setTimeout(() => {
        resetForm();
        setPublished(false);
      }, 2200);
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory(DEFAULT_SERVICE_SLUG);
    setPayAmount('');
    setDepartment('Managua');
    setAddressDetail('');
    setDuration('4');
    setWorkers('1');
    setError('');
  };

  const handlePublish = async () => {
    if (!profile?.id) {
      setError('Sesión inválida. Cierra sesión e ingresa de nuevo como administrador.');
      return;
    }

    const fullAddress = formatJobAddress(department, addressDetail);
    const validation = validateJobForm(title, description, pay, fullAddress, category);
    if (!validation.valid) { setError(validation.message); return; }
    setError('');

    const coords = DEPARTMENT_COORDS[department];

    try {
      await ensureProfileInDb(profile);
    } catch (syncErr: unknown) {
      const msg = syncErr instanceof Error ? syncErr.message : 'No se pudo verificar tu perfil';
      setError(msg);
      return;
    }

    try {
      await publish({
        title:           title.trim(),
        description:     description.trim(),
        category,
        payAmount:       pay,
        address:         fullAddress,
        lat:             coords.lat,
        lng:             coords.lng,
        durationHours:   parseFloat(durationHours) || 4,
        requiredWorkers: parseInt(requiredWorkers, 10) || 1,
        createdBy:       profile.id,
        relaxedPricing:  true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo publicar la chamba';
      setError(msg);
      if (Platform.OS === 'web') {
        showMessage('Error al publicar', msg);
      } else {
        Alert.alert('Error al publicar', msg);
      }
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={chambaStyles.screenHeader}>
          <Text style={chambaStyles.screenTitle}>Publicar Subasta</Text>
          <Text style={chambaStyles.screenSubtitle}>
            Configurá opciones sin código — los cambios se reflejan en el radar al instante.
          </Text>
        </View>

        {/* Tipo de trabajo */}
        <ConsoleSection
          label="Tipo de trabajo"
          hint={`${serviceTypes.length} servicios disponibles — gestioná más en Catálogo`}
          bare
        >
          {catalogLoading ? (
            <View style={styles.typeEmptyCard}>
              <Text style={styles.sectionHint}>Cargando catálogo…</Text>
            </View>
          ) : serviceTypes.length === 0 ? (
            <View style={styles.typeEmptyCard}>
              <View style={[chambaStyles.iconCircleRight, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="construct-outline" size={22} color="#FFF" />
              </View>
              <Text style={styles.typeEmptyTitle}>Sin tipos de trabajo</Text>
              <Text style={styles.typeEmptySub}>Agregá servicios en la pestaña Catálogo</Text>
            </View>
          ) : (
            <View style={styles.typeList}>
              {groupedServiceTypes.map(({ group, types }) => (
                <View key={group.id} style={styles.typeGroup}>
                  <Text style={styles.typeGroupLabel}>
                    {group.icon} {group.label}
                  </Text>
                  {types.map((st) => (
                    <ServiceTypeRow
                      key={st.id}
                      serviceType={st}
                      active={category === st.slug}
                      onPress={() => handleSelectServiceType(st)}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
        </ConsoleSection>

        {/* Detalles */}
        <ConsoleSection label="Detalles del trabajo">          <View style={styles.formInner}>
            <Input
              label="Título"
              placeholder="Carga de materiales en bodega norte"
              value={title}
              onChangeText={setTitle}
              leftIcon="create-outline"
            />
            <Input
              label="Descripción"
              placeholder="Describe el trabajo, materiales, condiciones especiales..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={{ height: 100, textAlignVertical: 'top', paddingTop: 12 }}
              leftIcon="document-text-outline"
            />
          </View>
        </ConsoleSection>

        {/* Departamento */}
        <ConsoleSection
          label="Departamento"
          hint="Managua · Masaya · Granada — visible en negrilla para técnicos"
        >          <View style={styles.deptRow}>
            {CHAMBA_DEPARTMENTS.map((dept) => {
              const active = department === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  onPress={() => setDepartment(dept)}
                  activeOpacity={0.85}
                  style={[styles.deptPill, active && styles.deptPillActive]}
                >
                  <Ionicons
                    name="map-outline"
                    size={20}
                    color={active ? CHAMBA.blue : CHAMBA.muted}
                  />
                  <Text style={[styles.deptLabel, active && styles.deptLabelActive]}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.formInner, { paddingTop: 0 }]}>
            <Input
              label="Detalle de ubicación (opcional)"
              placeholder="Colonia, referencia, barrio..."
              value={addressDetail}
              onChangeText={setAddressDetail}
              leftIcon="navigate-outline"
            />
          </View>
        </ConsoleSection>

        {/* Pago */}
        <ConsoleSection label="Pago y duración">
          <View style={styles.formInner}>
            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Monto total (C$)"
                  placeholder="500.00"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="decimal-pad"
                  leftIcon="cash-outline"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Duración (hrs)"
                  placeholder="4"
                  value={durationHours}
                  onChangeText={setDuration}
                  keyboardType="decimal-pad"
                  leftIcon="time-outline"
                />
              </View>
            </View>
            <Input
              label="Trabajadores necesarios"
              placeholder="1"
              value={requiredWorkers}
              onChangeText={setWorkers}
              keyboardType="number-pad"
              leftIcon="people-outline"
            />
          </View>
        </ConsoleSection>

        {/* Desglose */}
        {pay > 0 && (
          <ConsoleSection label="Desglose de pago">
            <View style={styles.formInner}>
              <PayRow label="Monto total del cliente" value={formatCurrency(pay)} />
              <PayRow
                label="Comisión plataforma (5%)"
                value={`−${formatCurrency(fee)}`}
                valueColor="#B91C1C"
              />
              <View style={styles.payDivider} />
              <PayRow
                label="Pago al trabajador (95%)"
                value={formatCurrency(payout)}
                valueColor="#34C759"
                bold
                large
              />
            </View>
          </ConsoleSection>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="close-circle" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {published ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={40} color="#34C759" />
            <Text style={styles.successTitle}>¡Subasta publicada!</Text>
            <Text style={styles.successSub}>
              Los técnicos ya pueden verla en el radar en tiempo real
            </Text>
          </View>
        ) : (
          <Button
            label="Publicar en el Radar"
            onPress={handlePublish}
            isLoading={isPending}
            fullWidth
            size="lg"
            icon={<Ionicons name="flash" size={18} color="#FFF" />}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.bg },
  scroll: { paddingHorizontal: 20, gap: 16, paddingTop: 8 },
  consoleSection: { gap: 8 },
  sectionHint: { fontSize: 13, color: CHAMBA.muted, fontWeight: '400', marginBottom: 4 },
  ambientCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    overflow: 'hidden',
    ...CARD_STEP_SHADOW,
  },
  formInner: { padding: 18, gap: 16 },
  typeList: { gap: 4 },
  typeGroup: { marginBottom: 8 },
  typeGroupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: CHAMBA.muted,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  typeRow: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    ...CARD_STEP_SHADOW,
  },
  typeRowActive: {
    borderColor: CHAMBA.cyan,
    backgroundColor: '#E0F2FE',
  },
  typeTitleActive: { color: CHAMBA.blue },
  typeSubtitleActive: { color: '#0369A1' },
  typePrice: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  typePriceActive: { color: CHAMBA.blue },
  typeEmoji: { fontSize: 20 },
  typeEmptyCard: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    ...CARD_STEP_SHADOW,
  },
  typeEmptyTitle: { fontSize: 16, fontWeight: '600', color: CHAMBA.navy, textAlign: 'center' },
  typeEmptySub: { fontSize: 13, color: CHAMBA.muted, textAlign: 'center', fontWeight: '400' },
  deptRow: { flexDirection: 'row', gap: 12, padding: 18, paddingBottom: 0 },  deptPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: CHAMBA.white,
    gap: 6,
  },
  deptPillActive: { borderColor: CHAMBA.cyan, backgroundColor: '#E0F2FE' },
  deptLabel: { fontSize: 13, fontWeight: '600', color: CHAMBA.navy },
  deptLabelActive: { color: CHAMBA.blue },
  twoCol: { flexDirection: 'row', gap: 12 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payLabel: { fontSize: 14, color: CHAMBA.muted, fontWeight: '400' },
  payValue: { fontSize: 15 },
  payDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 18,
    padding: 16,
  },
  errorText: { fontSize: 14, color: '#B91C1C', flex: 1, fontWeight: '400' },
  successBox: {
    backgroundColor: '#DCFCE7',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successTitle: { fontSize: 16, fontWeight: '600', color: '#15803D' },
  successSub: { fontSize: 14, textAlign: 'center', color: '#166534', fontWeight: '400' },
});
