import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  LayoutAnimation,
  UIManager,
} from 'react-native';
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
import {
  JobSchedulingSection,
  useJobSchedulingFields,
} from '@components/jobs/JobSchedulingSection';
import { ClientJobLocationSection } from '@components/client/ClientJobLocationSection';
import { jobCoordinatesForCreate } from '@utils/shareJobLocation';
import { ScreenBackButton } from '@components/navigation/ScreenBackButton';
import { ChambaPublishSuccess } from '@components/chamba/ChambaPublishSuccess';
import { JobExpiryBadge } from '@components/shared/JobExpiryBadge';
import {
  CARD_STEP_SHADOW,
  CHAMBA,
  TOUCH_TARGET_MIN,
  chambaStyles,
} from '@constants/chambaUI';
import { textInputWebFocusStyle } from '@constants/textInputFocus';
import { formatCurrency } from '@utils/formatters';
import { useCatalog } from '@features/catalog/hooks/useCatalog';
import { usePreciosCatalog } from '@features/catalog/hooks/usePreciosCatalog';
import { useClientPublishLimit } from '@features/jobs/hooks/useJobActiveLimits';
import { resolveOfferSuggestedPriceFromDb } from '@utils/offerSuggestedPrice';
import { useSupportBubbleScrollHandlers } from '@hooks/useSupportBubbleScrollHandlers';
import {
  getClientMinimumOffer,
  parseOfferAmountInput,
  validateClientOfferAmount,
} from '@utils/clientOfferValidation';
import type { ClientStackParamList } from '@/types';

type Nav = NativeStackNavigationProp<ClientStackParamList, 'CreateJobForm'>;
type Route = RouteProp<ClientStackParamList, 'CreateJobForm'>;

const DEEP_BLUE = '#1E293B';
const SCREEN_BG = '#F9FAFB';
const TOTAL_STEPS = 2;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const CreateJobFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const publishLimit = useClientPublishLimit();
  const supportBubbleScroll = useSupportBubbleScrollHandlers();

  const serviceTypeSlug =
    route.params.serviceTypeSlug ?? route.params.clientCategory ?? '';
  const serviceLabel = route.params.serviceLabel;
  const catalog = useCatalog();
  const precios = usePreciosCatalog();
  const label = catalog.getLabel(serviceTypeSlug) || serviceLabel;

  const normalizedServiceSlug = serviceTypeSlug.trim().toLowerCase();
  const suggestedPrice = precios.getSuggestedPrice(normalizedServiceSlug);
  const pricesReady = !precios.isLoading && suggestedPrice > 0;

  useEffect(() => {
    void precios.refetch();
  }, [normalizedServiceSlug, precios.refetch]);

  const [currentStep, setCurrentStep] = useState(1);
  const [description, setDescription] = useState(route.params.initialDescription ?? '');
  const [address, setAddress] = useState('');
  const [serviceLat, setServiceLat] = useState<number | null>(null);
  const [serviceLng, setServiceLng] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [publishedMeta, setPublishedMeta] = useState<{ id: string; created_at: string } | null>(null);
  const [requestPhotoUri, setRequestPhotoUri] = useState<string | null>(null);
  const [offerPriceText, setOfferPriceText] = useState(
    route.params.initialOfferPrice ? String(route.params.initialOfferPrice) : ''
  );
  const schedulingFields = useJobSchedulingFields();

  const suggestedMinimum = useMemo(
    () => getClientMinimumOffer(suggestedPrice),
    [suggestedPrice],
  );

  const offerAmount = useMemo(
    () => parseOfferAmountInput(offerPriceText),
    [offerPriceText],
  );

  const offerValidation = useMemo(
    () => validateClientOfferAmount(offerAmount, suggestedPrice),
    [offerAmount, suggestedPrice],
  );

  const autoTitle = label.trim() || serviceLabel;

  const isStep1Valid =
    description.trim().length > 0 && schedulingFields.isScheduleValid;

  const canSubmit =
    isStep1Valid &&
    address.trim().length > 0 &&
    pricesReady &&
    offerValidation.valid &&
    !publishLimit.atLimit;

  const animateStepChange = useCallback((nextStep: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentStep(nextStep);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const handleNextStep = () => {
    if (!isStep1Valid) {
      const msg =
        schedulingFields.scheduleError ??
        'Contanos qué necesitás y elegí cuándo lo querés.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Completá el paso 1', msg);
      return;
    }
    if (!offerPriceText.trim() && suggestedPrice > 0) {
      setOfferPriceText(String(Math.round(suggestedPrice)));
    }
    animateStepChange(2);
  };

  const handleBackToStep1 = () => {
    animateStepChange(1);
  };

  const handleSubmit = async () => {
    if (!profile?.id || !canSubmit) return;

    if (publishLimit.atLimit) {
      const msg = publishLimit.message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Límite de solicitudes', msg);
      return;
    }

    if (!schedulingFields.isScheduleValid) {
      const msg = schedulingFields.scheduleError ?? 'Revisá la fecha del servicio';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Programación', msg);
      return;
    }

    if (!offerValidation.valid) {
      const msg = offerValidation.message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Oferta inválida', msg);
      return;
    }

    setIsSubmitting(true);
    try {
      await assertClientJobPlatformReady();
      const creatorId = await resolveClientIdForJobs(profile);

      let mediaUrls: string[] | undefined;
      if (requestPhotoUri) {
        const photoUrl = await uploadJobRequestPhoto(creatorId, requestPhotoUri);
        mediaUrls = [photoUrl];
      }

      const coords = jobCoordinatesForCreate(serviceLat, serviceLng);

      const created = await createJob({
        title: autoTitle,
        description: description.trim(),
        category: serviceTypeSlug,
        payAmount: offerAmount,
        address: address.trim(),
        lat: coords.lat,
        lng: coords.lng,
        durationHours: 2,
        requiredWorkers: 1,
        createdBy: creatorId,
        mediaUrls,
        urgencyLevel: schedulingFields.schedulingPayload.urgencyLevel,
        scheduledDate: schedulingFields.schedulingPayload.scheduledDate,
        scheduledTime: schedulingFields.schedulingPayload.scheduledTime,
      });

      setPublishedMeta({ id: created.id, created_at: created.created_at });

      setSuccessMessage(
        `Tu solicitud de "${serviceLabel}" quedó en pendiente. Revisala en Mis Solicitudes → Pendientes.`,
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
      console.error('[CreateJobForm] publish failed — raw error:', err);
      if (err && typeof err === 'object') {
        const supa = err as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };
        console.error('[CreateJobForm] Supabase fields:', {
          message: supa.message ?? String(err),
          details: supa.details ?? null,
          hint: supa.hint ?? null,
          code: supa.code ?? null,
        });
      }
      const message = err instanceof Error ? err.message : 'Error al enviar';
      if (Platform.OS === 'web') window.alert(`Error: ${message}`);
      else Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessDismiss = useCallback(() => {
    setShowSuccess(false);
    setPublishedMeta(null);
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

  const progressWidth = `${(currentStep / TOTAL_STEPS) * 100}%` as `${number}%`;
  const submitEnabled = canSubmit && !isSubmitting;
  const nextEnabled = isStep1Valid && !isSubmitting;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ScreenBackButton
          onPress={() => {
            if (currentStep === 2) {
              handleBackToStep1();
            } else {
              navigation.goBack();
            }
          }}
          color={DEEP_BLUE}
        />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nueva Solicitud</Text>
          <Text style={styles.stepLabel}>
            Paso {currentStep} de {TOTAL_STEPS}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...supportBubbleScroll}
      >
        {publishLimit.atLimit && (
          <View style={styles.limitBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#0284C7" />
            <Text style={styles.limitBannerText}>{publishLimit.message}</Text>
          </View>
        )}

        {currentStep === 1 ? (
          <>
            <Text style={styles.blockTitle}>Detalles del Trabajo</Text>
            <Text style={styles.blockSubtitle}>
              Contanos qué necesitás y cuándo lo querés
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>El servicio</Text>
              <View style={styles.serviceBadge}>
                <Ionicons name="sparkles-outline" size={14} color={DEEP_BLUE} />
                <Text style={styles.serviceBadgeText}>{label}</Text>
              </View>

              <Text style={chambaStyles.formLabel}>Descripción</Text>
              <View style={[chambaStyles.formInputRow, styles.descriptionRow]}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Contanos un poco más sobre lo que necesitás..."
                  placeholderTextColor={CHAMBA.muted}
                  multiline
                  style={[styles.descriptionInput, textInputWebFocusStyle]}
                  editable={!isSubmitting}
                />
              </View>

              <JobRequestPhotoPicker
                photoUri={requestPhotoUri}
                onPhotoChange={setRequestPhotoUri}
                disabled={isSubmitting}
                variant="minimal"
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>¿Cuándo lo necesitás?</Text>
              <JobSchedulingSection
                hideTitle
                embedded
                accentColor={DEEP_BLUE}
                urgencyLevel={schedulingFields.urgencyLevel}
                onUrgencyChange={schedulingFields.setUrgencyLevel}
                scheduledDate={schedulingFields.scheduledDate}
                onScheduledDateChange={schedulingFields.setScheduledDate}
                scheduledTime={schedulingFields.scheduledTime}
                onScheduledTimeChange={schedulingFields.setScheduledTime}
                disabled={isSubmitting}
              />
              {schedulingFields.scheduleError ? (
                <Text style={styles.scheduleError}>{schedulingFields.scheduleError}</Text>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.blockTitle}>Ubicación y Confirmación</Text>
            <Text style={styles.blockSubtitle}>
              Indicá dónde y revisá el precio antes de enviar
            </Text>
            <View style={styles.radarHintRow}>
              <Ionicons name="radio-outline" size={14} color="#0284C7" />
              <Text style={styles.radarHintText}>
                Tras publicar, tu chamba estará 60 min en el radar de técnicos
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>Dirección</Text>
              <ClientJobLocationSection
                hideHeader
                address={address}
                onAddressChange={setAddress}
                lat={serviceLat}
                lng={serviceLng}
                onCoordsChange={(nextLat, nextLng) => {
                  setServiceLat(nextLat);
                  setServiceLng(nextLng);
                }}
                disabled={isSubmitting}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>Resumen</Text>
              <Text style={styles.summaryService}>{label}</Text>
              {description.trim() ? (
                <Text style={styles.summaryDescription} numberOfLines={3}>
                  {description.trim()}
                </Text>
              ) : null}
              <View style={styles.priceBlock}>
                {!pricesReady ? (
                  <View style={styles.priceLoadingRow}>
                    <ActivityIndicator size="small" color={CHAMBA.blue} />
                    <Text style={styles.suggestedLine}>
                      Cargando precio sugerido desde el catálogo…
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.suggestedLine}>
                    Precio sugerido: {formatCurrency(suggestedPrice)}
                  </Text>
                )}
                <Text style={styles.priceLabel}>Tu oferta (C$)</Text>
                <View style={styles.offerInputRow}>
                  <Text style={styles.currencyPrefix}>C$</Text>
                  <TextInput
                    value={offerPriceText}
                    onChangeText={setOfferPriceText}
                    placeholder={
                      suggestedPrice > 0
                        ? String(Math.round(suggestedPrice))
                        : '0'
                    }
                    placeholderTextColor={CHAMBA.muted}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    style={[styles.offerInput, textInputWebFocusStyle]}
                    editable={!isSubmitting}
                  />
                </View>
                {!offerValidation.valid && offerPriceText.trim().length > 0 ? (
                  <Text style={styles.priceError}>{offerValidation.message}</Text>
                ) : (
                  <Text style={styles.priceNote}>
                    Mínimo aceptable: {formatCurrency(suggestedMinimum)} (70% del sugerido).
                    El pago se realiza directamente al técnico al finalizar.
                  </Text>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {currentStep === 1 ? (
          <TouchableOpacity
            onPress={handleNextStep}
            disabled={!nextEnabled}
            activeOpacity={0.88}
            style={[
              styles.primaryBtn,
              !nextEnabled && styles.primaryBtnDisabled,
            ]}
          >
            <Text style={styles.primaryBtnText}>Siguiente paso</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              onPress={handleBackToStep1}
              disabled={isSubmitting}
              style={styles.backLink}
              activeOpacity={0.7}
            >
              <Text style={styles.backLinkText}>← Volver al paso 1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!submitEnabled}
              activeOpacity={0.88}
              style={[
                styles.primaryBtn,
                !submitEnabled && styles.primaryBtnDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#FFF" />
                  <Text style={styles.primaryBtnText}>Confirmar Solicitud</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      <ChambaPublishSuccess
        visible={showSuccess}
        title="¡Solicitud en pendiente!"
        message={successMessage}
        slogan="Estado: esperando técnico · Mis Solicitudes → Pendientes"
        expiryJobId={publishedMeta?.id}
        expiryCreatedAt={publishedMeta?.created_at}
        onDismiss={handleSuccessDismiss}
        autoHideMs={5500}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: SCREEN_BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DEEP_BLUE,
    letterSpacing: -0.3,
  },
  stepLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.2,
  },
  progressTrack: {
    marginTop: 8,
    width: '100%',
    maxWidth: 160,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: DEEP_BLUE,
    borderRadius: 2,
  },
  headerSpacer: { width: 40 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  blockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  blockSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 20,
  },
  radarHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  radarHintText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 17,
  },
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...CARD_STEP_SHADOW,
  },
  cardSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  serviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: DEEP_BLUE,
    letterSpacing: -0.2,
  },
  descriptionRow: {
    alignItems: 'flex-start',
    minHeight: 96,
    marginBottom: 4,
  },
  descriptionInput: {
    flex: 1,
    fontSize: 15,
    color: CHAMBA.navy,
    paddingVertical: 10,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  scheduleError: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  summaryService: {
    fontSize: 16,
    fontWeight: '700',
    color: DEEP_BLUE,
    marginBottom: 6,
  },
  summaryDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  priceBlock: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  suggestedLine: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  priceLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  offerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    minHeight: 52,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: DEEP_BLUE,
    marginRight: 8,
  },
  offerInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: DEEP_BLUE,
    paddingVertical: 8,
  },
  priceError: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    lineHeight: 18,
  },
  priceNote: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  limitBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: CHAMBA.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    minHeight: TOUCH_TARGET_MIN,
    paddingVertical: 16,
    backgroundColor: DEEP_BLUE,
    ...CARD_STEP_SHADOW,
  },
  primaryBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});
