import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { MaterialSymbol } from '@components/admin/MaterialSymbol';
import { createJob } from '@features/jobs/services/jobsService';
import { useAuthStore } from '@store/authStore';
import { JOB_KEYS } from '@features/jobs/hooks/useJobs';
import { validateJobForm } from '@utils/validation';
import { formatCurrency, getCategoryEmoji } from '@utils/formatters';
import { showMessage } from '@utils/confirmAction';
import { ensureProfileInDb } from '@utils/profileSync';
import { CONFIG } from '@constants/config';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import type { ServiceType } from '@features/catalog/types';
import { CHAMBA_DEPARTMENTS, DEPARTMENT_COORDS, type ChambaDepartment } from '@constants/departments';
import { formatJobAddress } from '@utils/locationFormat';
import {
  M3, SPACING, BORDER_RADIUS, CARD_ELEVATION, stitchTypography,
} from '@constants/stitchStyles';
import type { JobCategory } from '@/types';

// ─── Section (Consola No-Code) ────────────────────────────────────────────────

const ConsoleSection: React.FC<{
  icon: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ icon, label, hint, children }) => (
  <View style={styles.consoleSection}>
    <View style={styles.sectionHeader}>
      <MaterialSymbol name={icon} size={18} color={M3.primary} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
    {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    <View style={styles.ambientCard}>{children}</View>
  </View>
);

const PayRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
  large?: boolean;
}> = ({ label, value, valueColor = M3.onBackground, bold = false, large = false }) => (
  <View style={styles.payRow}>
    <Text style={[styles.payLabel, large && { fontSize: 16 }]}>{label}</Text>
    <Text style={[
      styles.payValue,
      { color: valueColor, fontWeight: bold ? '800' : '500', fontSize: large ? 20 : 15 },
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

  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory]       = useState<JobCategory>('limpieza_sofas');
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
    setCategory('limpieza_sofas');
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + SPACING.md, paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header ejecutivo */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialSymbol name="tune" size={22} color={M3.onPrimaryContainer} filled />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Consola No-Code</Text>
            <Text style={styles.title}>Publicar Subasta</Text>
            <Text style={styles.subtitle}>
              Configura opciones sin código — los cambios se reflejan en el radar al instante.
            </Text>
          </View>
        </View>

        {/* Categoría legacy BD */}
        <ConsoleSection
          icon="category"
          label="Tipo de trabajo"
          hint={`${serviceTypes.length} servicios disponibles — gestiona más en Catálogo`}
        >
          {catalogLoading ? (
            <Text style={styles.sectionHint}>Cargando catálogo…</Text>
          ) : serviceTypes.length === 0 ? (
            <Text style={styles.sectionHint}>No hay tipos de trabajo en el catálogo.</Text>
          ) : (
            <View style={styles.pillRow}>
              {serviceTypes.map((st: ServiceType) => {
                const active = category === st.slug;
                return (
                  <TouchableOpacity
                    key={st.id}
                    onPress={() => setCategory(st.slug)}
                    activeOpacity={0.85}
                    style={[styles.categoryPill, active && styles.categoryPillActive]}
                  >
                    <Text style={{ fontSize: 22 }}>{st.icon}</Text>
                    <Text style={[styles.categoryDbLabel, active && styles.categoryDbLabelActive]}>
                      {st.name}
                    </Text>
                    <Text style={[styles.categoryAppLabel, active && styles.categoryAppLabelActive]}>
                      C${st.suggested_price}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ConsoleSection>

        {/* Detalles */}
        <ConsoleSection icon="inventory_2" label="Detalles del trabajo">
          <View style={styles.formInner}>
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
          icon="location_on"
          label="Departamento"
          hint="Managua · Masaya · Granada — visible en negrilla para técnicos"
        >
          <View style={styles.deptRow}>
            {CHAMBA_DEPARTMENTS.map((dept) => {
              const active = department === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  onPress={() => setDepartment(dept)}
                  activeOpacity={0.85}
                  style={[styles.deptPill, active && styles.deptPillActive]}
                >
                  <MaterialSymbol
                    name="map"
                    size={20}
                    color={active ? M3.onPrimaryContainer : M3.primary}
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
        <ConsoleSection icon="attach_money" label="Pago y duración">
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
          <ConsoleSection icon="payments" label="Desglose de pago">
            <View style={styles.formInner}>
              <PayRow label="Monto total del cliente" value={formatCurrency(pay)} />
              <PayRow
                label="Comisión plataforma (5%)"
                value={`−${formatCurrency(fee)}`}
                valueColor={M3.error}
              />
              <View style={styles.payDivider} />
              <PayRow
                label="Pago al trabajador (95%)"
                value={formatCurrency(payout)}
                valueColor={M3.primaryContainer}
                bold
                large
              />
            </View>
          </ConsoleSection>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <MaterialSymbol name="cancel" size={18} color={M3.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {published ? (
          <View style={styles.successBox}>
            <MaterialSymbol name="check_circle" size={40} color={M3.secondary} filled />
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
            icon={<MaterialSymbol name="flash_on" size={18} color={M3.onPrimary} filled />}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: M3.background,
  },
  scroll: {
    paddingHorizontal: SPACING.md,
    gap:               SPACING.md + 4,
  },
  header: {
    flexDirection: 'row',
    gap:           SPACING.sm + 4,
    alignItems:    'flex-start',
  },
  headerIcon: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: M3.primaryContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  eyebrow: {
    ...stitchTypography.labelBold,
    color:         M3.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    ...stitchTypography.headlineLg,
    marginTop: 2,
  },
  subtitle: {
    ...stitchTypography.bodySm,
    marginTop: 4,
  },
  consoleSection: {
    gap: SPACING.xs + 2,
  },
  sectionHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.xs + 2,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    ...stitchTypography.headlineMdMobile,
    fontSize: 16,
  },
  sectionHint: {
    ...stitchTypography.labelBold,
    color:             M3.outline,
    paddingHorizontal: 4,
    marginBottom:      2,
  },
  ambientCard: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius:    12,
    overflow:        'hidden',
    ...CARD_ELEVATION,
  },
  formInner: {
    padding: SPACING.md,
    gap:     SPACING.md,
  },
  pillRow: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    gap:               SPACING.sm,
    padding:           SPACING.md,
    justifyContent:    'space-between',
  },
  categoryPill: {
    width:             '48%',
    minWidth:          140,
    alignItems:        'center',
    padding:           SPACING.md,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1.5,
    borderColor:       M3.outlineVariant,
    backgroundColor:   M3.surface,
  },
  categoryPillActive: {
    borderColor:     M3.primary,
    backgroundColor: M3.primaryContainer,
  },
  categoryDbLabel: {
    ...stitchTypography.headlineMdMobile,
    marginTop:     6,
    textAlign:     'center',
    fontSize:      13,
  },
  categoryDbLabelActive: {
    color: M3.onPrimaryContainer,
  },
  categoryAppLabel: {
    ...stitchTypography.labelBold,
    marginTop: 4,
    textAlign: 'center',
    color:     M3.outline,
  },
  categoryAppLabelActive: {
    color: M3.primaryFixedDim,
  },
  deptRow: {
    flexDirection:     'row',
    gap:               SPACING.sm,
    padding:           SPACING.md,
    paddingBottom:     0,
  },
  deptPill: {
    flex:              1,
    alignItems:        'center',
    paddingVertical:   SPACING.md,
    paddingHorizontal: SPACING.xs,
    borderRadius:      BORDER_RADIUS.md,
    borderWidth:       1.5,
    borderColor:       M3.outlineVariant,
    backgroundColor:   M3.surface,
    gap:               6,
  },
  deptPillActive: {
    borderColor:     M3.primary,
    backgroundColor: M3.primaryContainer,
  },
  deptLabel: {
    ...stitchTypography.labelBold,
    fontSize: 13,
    color:    M3.onBackground,
  },
  deptLabelActive: {
    color: M3.onPrimaryContainer,
  },
  twoCol: {
    flexDirection: 'row',
    gap:           SPACING.sm,
  },
  payRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  payLabel: {
    ...stitchTypography.bodySm,
    color: M3.onSurfaceVariant,
  },
  payValue: {
    fontSize: 15,
  },
  payDivider: {
    height:          1,
    backgroundColor: M3.surfaceVariant,
    marginVertical:  4,
  },
  errorBox: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    backgroundColor:   M3.errorContainer,
    borderRadius:      BORDER_RADIUS.md,
    padding:           SPACING.md,
  },
  errorText: {
    ...stitchTypography.bodySm,
    color: M3.onErrorContainer,
    flex:  1,
  },
  successBox: {
    backgroundColor: M3.secondaryFixed,
    borderRadius:    BORDER_RADIUS.lg,
    padding:         SPACING.xl,
    alignItems:      'center',
    gap:             SPACING.sm,
    borderWidth:     1,
    borderColor:     M3.secondaryContainer,
  },
  successTitle: {
    ...stitchTypography.headlineMdMobile,
    color: M3.onSecondaryFixedVariant,
  },
  successSub: {
    ...stitchTypography.bodySm,
    textAlign: 'center',
    color:     M3.onSecondaryFixedVariant,
  },
});
