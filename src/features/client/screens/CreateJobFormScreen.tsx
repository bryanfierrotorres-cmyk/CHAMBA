import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@store/authStore';
import {
  createJob,
  fetchClientOrders,
  resolveClientIdForJobs,
} from '@features/jobs/services/jobsService';
import { assertClientJobPlatformReady } from '@services/clientJobPlatform';
import { JOB_KEYS } from '@features/jobs/hooks/useJobs';
import { uploadJobRequestPhoto } from '@features/jobs/services/jobRequestPhotoService';
import { JobRequestPhotoPicker } from '@components/jobs/JobRequestPhotoPicker';
import { ClientJobLocationSection } from '@components/client/ClientJobLocationSection';
import { hasUsableJobCoordinates } from '@utils/shareJobLocation';
import { isExpressServiceSlug } from '@constants/servicesConfig';
import { ScreenBackButton } from '@components/navigation/ScreenBackButton';
import { ChambaPublishSuccess } from '@components/chamba/ChambaPublishSuccess';
import { ChambaFormField } from '@components/chamba/ChambaFormField';
import {
  CARD_STEP_SHADOW,
  CHAMBA,
  GRADIENT_TOGGLE,
  TOUCH_TARGET_MIN,
  chambaStyles,
} from '@constants/chambaUI';
import {
  getServiceIconBg,
  renderServiceIconBySlug,
} from '@constants/clientHomeServiceIcons';
import { validateClientPrice } from '@constants/servicePricing';
import { formatCurrency } from '@utils/formatters';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import type { ClientStackParamList } from '@/types';

type Nav = NativeStackNavigationProp<ClientStackParamList, 'CreateJobForm'>;
type Route = RouteProp<ClientStackParamList, 'CreateJobForm'>;

export const CreateJobFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();

  const serviceTypeSlug =
    route.params.serviceTypeSlug ?? route.params.clientCategory ?? '';
  const serviceLabel = route.params.serviceLabel;
  const catalog = useCatalog();
  const label = catalog.getLabel(serviceTypeSlug) || serviceLabel;
  const priceLookup = {
    getSuggestedPrice: catalog.getSuggestedPrice,
    getMinPrice: catalog.getMinPrice,
  };

  const suggestedPrice = catalog.getSuggestedPrice(serviceTypeSlug);
  const minimumPrice = catalog.getMinPrice(serviceTypeSlug);
  const iconBg = getServiceIconBg(serviceTypeSlug, serviceTypeSlug);

  const [title, setTitle] = useState(`Solicitud: ${serviceLabel}`);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [serviceLat, setServiceLat] = useState<number | null>(null);
  const [serviceLng, setServiceLng] = useState<number | null>(null);
  const [budget, setBudget] = useState(String(suggestedPrice));
  const [durationHours, setDurationHours] = useState('2');
  const [requiredWorkers, setRequiredWorkers] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [requestPhotoUri, setRequestPhotoUri] = useState<string | null>(null);

  const showRequestPhoto = isExpressServiceSlug(serviceTypeSlug);
  const isPetCustomRequest = serviceTypeSlug === 'pet_personalizado';

  const budgetAmount = Number(budget);
  const priceValidation = useMemo(
    () =>
      budget.trim()
        ? validateClientPrice(serviceTypeSlug, budgetAmount, priceLookup)
        : { valid: false, message: '' },
    [serviceTypeSlug, budget, budgetAmount, catalog],
  );

  const hasLocation = hasUsableJobCoordinates(serviceLat, serviceLng);

  const canSubmit =
    title.trim() &&
    description.trim() &&
    address.trim() &&
    hasLocation &&
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
    if (!profile?.id || !canSubmit || serviceLat == null || serviceLng == null) return;

    const priceCheck = validateClientPrice(serviceTypeSlug, budgetAmount, priceLookup);
    if (!priceCheck.valid) {
      setBudgetError(priceCheck.message);
      if (Platform.OS === 'web') window.alert(priceCheck.message);
      else Alert.alert('Presupuesto inválido', priceCheck.message);
      return;
    }

    setIsSubmitting(true);
    try {
      await assertClientJobPlatformReady();
      const creatorId = await resolveClientIdForJobs(profile);

      let mediaUrls: string[] | undefined;
      if (showRequestPhoto && requestPhotoUri) {
        const photoUrl = await uploadJobRequestPhoto(creatorId, requestPhotoUri);
        mediaUrls = [photoUrl];
      }

      await createJob({
        title: title.trim(),
        description: description.trim(),
        category: serviceTypeSlug,
        payAmount: budgetAmount,
        address: address.trim(),
        lat: serviceLat,
        lng: serviceLng,
        durationHours: Number(durationHours) || 2,
        requiredWorkers: Number(requiredWorkers) || 1,
        createdBy: creatorId,
        mediaUrls,
      });

      setSuccessMessage(
        `Tu solicitud de "${serviceLabel}" quedó en pendiente. Revisala en Mis Solicitudes → Activas.`,
      );
      setShowSuccess(true);

      const ordersKey = JOB_KEYS.clientOrders(creatorId);
      void queryClient.invalidateQueries({ queryKey: ['client-orders'] });
      void queryClient
        .prefetchQuery({
          queryKey: ordersKey,
          queryFn: () => fetchClientOrders(creatorId),
        })
        .catch((cacheErr) => {
          console.warn('[CreateJobForm] prefetch orders:', cacheErr);
        });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar';
      if (Platform.OS === 'web') window.alert(`Error: ${message}`);
      else Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessDismiss = useCallback(() => {
    setShowSuccess(false);
    const tabNav = navigation.getParent();
    if (tabNav) {
      tabNav.navigate('ClientOrders' as never);
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } else {
      navigation.goBack();
    }
  }, [navigation]);

  const submitEnabled = canSubmit && !isSubmitting;

  return (
    <View style={[chambaStyles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ScreenBackButton onPress={() => navigation.goBack()} color={CHAMBA.navy} />
        <Text style={styles.headerTitle}>Nueva solicitud</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={chambaStyles.sectionTitle}>Detalles de tu solicitud</Text>
        <Text style={[chambaStyles.sectionSubtitle, styles.sectionGap]}>
          Completa los campos para publicar tu pedido
        </Text>

        <View style={chambaStyles.stepCard}>
          <View style={chambaStyles.stepCardContent}>
            <Text style={chambaStyles.cardTitle}>{serviceLabel}</Text>
            <Text style={chambaStyles.cardSubtitle}>{label}</Text>
          </View>
          <View style={[chambaStyles.iconCircleRight, { backgroundColor: iconBg }]}>
            {renderServiceIconBySlug(serviceTypeSlug)}
          </View>
        </View>

        <ChambaFormField
          label="Título de la solicitud"
          value={title}
          onChangeText={setTitle}
          placeholder="Ej. Limpieza de sofá y colchón"
          icon="create-outline"
        />
        <ChambaFormField
          label="Descripción detallada"
          value={description}
          onChangeText={setDescription}
          placeholder={
            isPetCustomRequest
              ? 'Ej. cuidado de gato senior, medicación, horarios, tipo de mascota...'
              : 'Describe qué necesitas, el estado actual, preferencias...'
          }
          multiline
          icon="document-text-outline"
        />

        {showRequestPhoto && (
          <JobRequestPhotoPicker
            photoUri={requestPhotoUri}
            onPhotoChange={setRequestPhotoUri}
            disabled={isSubmitting}
          />
        )}

        <ClientJobLocationSection
          address={address}
          onAddressChange={setAddress}
          lat={serviceLat}
          lng={serviceLng}
          onCoordsChange={(lat, lng) => {
            setServiceLat(lat);
            setServiceLng(lng);
          }}
          disabled={isSubmitting}
        />

        <View style={styles.row}>
          <View style={styles.rowCol}>
            <ChambaFormField
              label="Presupuesto (C$)"
              value={budget}
              onChangeText={handleBudgetChange}
              placeholder={String(suggestedPrice)}
              keyboardType="decimal-pad"
              icon="cash-outline"
            />
            <View style={styles.priceHintBox}>
              <Text style={styles.priceHint}>
                Precio sugerido: {formatCurrency(suggestedPrice)}
              </Text>
              <Text style={styles.priceHintMuted}>
                Mínimo: {formatCurrency(minimumPrice)} (50% del sugerido)
              </Text>
              {budgetError ? (
                <Text style={styles.priceError}>{budgetError}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.rowGap} />
          <View style={styles.rowCol}>
            <ChambaFormField
              label="Duración (horas)"
              value={durationHours}
              onChangeText={setDurationHours}
              placeholder="2"
              keyboardType="numeric"
              icon="time-outline"
            />
          </View>
        </View>

        <ChambaFormField
          label="Trabajadores requeridos"
          value={requiredWorkers}
          onChangeText={setRequiredWorkers}
          placeholder="1"
          keyboardType="numeric"
          icon="people-outline"
        />

        <View style={styles.infoBox}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="information-circle" size={20} color={CHAMBA.blue} />
          </View>
          <Text style={styles.infoText}>
            Tu solicitud será visible para trabajadores verificados de la categoría
            seleccionada. Recibirás notificación cuando alguien la acepte.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!submitEnabled}
          activeOpacity={0.88}
          style={!submitEnabled && styles.submitTouchableDisabled}
        >
          <LinearGradient
            colors={submitEnabled ? [...GRADIENT_TOGGLE] : ['#CBD5E1', '#94A3B8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitBtn}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="flash" size={20} color="#FFF" />
                <Text style={styles.submitBtnText}>Enviar solicitud</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ChambaPublishSuccess
        visible={showSuccess}
        title="¡Solicitud en pendiente!"
        message={successMessage}
        slogan="Estado: esperando técnico · Mis Solicitudes → Activas"
        onDismiss={handleSuccessDismiss}
        autoHideMs={4000}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CHAMBA.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: CHAMBA.navy,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 40 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionGap: { marginBottom: 16 },
  row: { flexDirection: 'row' },
  rowCol: { flex: 1 },
  rowGap: { width: 12 },
  priceHintBox: { marginTop: -8, marginBottom: 8, gap: 2, paddingLeft: 2 },
  priceHint: {
    fontSize: 12,
    fontWeight: '700',
    color: CHAMBA.blue,
  },
  priceHintMuted: {
    fontSize: 12,
    color: CHAMBA.muted,
    fontWeight: '400',
  },
  priceError: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: CHAMBA.white,
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    ...CARD_STEP_SHADOW,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    color: CHAMBA.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: CHAMBA.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 24,
    minHeight: TOUCH_TARGET_MIN,
    paddingVertical: 16,
    ...CARD_STEP_SHADOW,
  },
  submitTouchableDisabled: { opacity: 0.85 },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
