import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ChambaSlidingToggle } from '@components/chamba/ChambaSlidingToggle';
import { useAuthStore } from '@store/authStore';
import { FONT_SIZE, SPACING } from '@constants/theme';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';
import { textInputWebFocusStyle } from '@constants/textInputFocus';
import { formatNicaPhone, isValidNicaPhone } from '@utils/phoneNicaragua';
import type { AuthStackParamList, UserRole } from '@/types';
import { LOGIN_SCREEN_LAYOUT } from '@features/auth/constants/loginScreenLayout';

type LoginNav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

const LOGIN_PRIMARY = '#1E293B';
const LOGIN_PRIMARY_PRESSED = '#334155';

const LOGIN_BG = require('../../../../assets/Gemini_Generated_Image_9bxg669bxg669bxg.png');

const COMPACT_BREAKPOINT = LOGIN_SCREEN_LAYOUT.compactBreakpoint;

const ROLE_TOGGLE_OPTIONS: { id: UserRole; label: string }[] = [
  { id: 'client', label: 'Cliente' },
  { id: 'worker', label: 'Trabajador' },
];

// ─── Premium field ─────────────────────────────────────────────────

interface PremiumFieldProps extends TextInputProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  onClearError?: () => void;
}

const PremiumField: React.FC<PremiumFieldProps> = ({
  label,
  icon,
  error,
  onClearError,
  value,
  onChangeText,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View
        style={[
          fieldStyles.row,
          focused && fieldStyles.rowFocused,
          !!error && fieldStyles.rowError,
        ]}
      >
        <View style={[fieldStyles.iconCircle, focused && fieldStyles.iconCircleFocused]}>
          <Ionicons name={icon} size={18} color={focused ? CHAMBA.blue : CHAMBA.muted} />
        </View>
        <TextInput
          value={value}
          onChangeText={(v) => {
            onChangeText?.(v);
            onClearError?.();
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor="#94A3B8"
          style={[fieldStyles.input, textInputWebFocusStyle]}
          {...rest}
        />
      </View>
      {!!error && <Text style={fieldStyles.errorText}>{error}</Text>}
    </View>
  );
};

// ─── Main screen ───────────────────────────────────────────────────

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginNav>();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isCompactLayout = screenWidth < COMPACT_BREAKPOINT;

  const { phoneSignIn, pilotSignIn, error, setError } = useAuthStore();
  const [adminAccessVisible, setAdminAccessVisible] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [nameErr, setNameErr] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [pendingAction, setPendingAction] = useState<'chamba' | 'admin' | null>(null);

  const isBusy = pendingAction !== null;

  const heroOp = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(-24)).current;
  const cardOp = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(40)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const roleHintOp = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setError(null);
    Animated.parallel([
      Animated.timing(heroOp, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(heroY, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(cardOp, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(cardY, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [cardOp, cardY, heroOp, heroY, setError]);

  useEffect(() => {
    roleHintOp.setValue(0);
    Animated.timing(roleHintOp, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [role, roleHintOp]);

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();

  const getPhoneDigits = () => phone.replace(/\D/g, '');

  const validatePhone = () => {
    let valid = true;
    setPhoneErr('');

    const telefono = getPhoneDigits();
    if (telefono.length !== 8) {
      setPhoneErr('Ingresá exactamente 8 dígitos de tu celular');
      valid = false;
    } else if (!isValidNicaPhone(telefono)) {
      setPhoneErr('Número inválido — debe iniciar con 2, 5, 7 u 8');
      valid = false;
    }
    return valid;
  };

  const validateLogin = () => {
    let valid = validatePhone();
    setNameErr('');
    if (!fullName.trim() || fullName.trim().split(/\s+/).length < 2) {
      setNameErr('Ingresá tu nombre completo (nombre y apellido)');
      valid = false;
    }
    return valid;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validateLogin()) {
      shake();
      return;
    }

    setPendingAction('chamba');
    const spinnerFailsafe = setTimeout(() => setPendingAction(null), 6_000);
    try {
      await phoneSignIn(fullName.trim(), phone, role);
    } catch {
      shake();
    } finally {
      clearTimeout(spinnerFailsafe);
      setPendingAction(null);
    }
  };

  const roleHint =
    role === 'client'
      ? 'Solicitá servicios para tu hogar o negocio'
      : 'Aceptá chambas y cobrá el 95% de cada trabajo';

  const bgImageStyle = [
    styles.bgImageCover,
    Platform.OS === 'web'
      ? { objectPosition: 'center 16%' as const }
      : {
          height: screenHeight * 1.22,
          top: -screenHeight * 0.11,
        },
  ];

  const showHeroExtras = !isCompactLayout;

  return (
    <View style={styles.root}>
      <Image
        source={LOGIN_BG}
        accessibilityIgnoresInvertColors
        style={bgImageStyle}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bgTopGradient}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { minHeight: screenHeight },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.layoutColumn}>
            <Animated.View
              style={[
                styles.hero,
                isCompactLayout && styles.heroCompact,
                { opacity: heroOp, transform: [{ translateY: heroY }] },
              ]}
            >
              {showHeroExtras ? (
                <TouchableOpacity
                  style={styles.logoWrap}
                  onPress={() => setAdminAccessVisible((v) => !v)}
                  activeOpacity={1}
                  accessibilityLabel="Logo CHAMBA"
                >
                  <LinearGradient
                    colors={['rgba(13,148,136,0.35)', 'rgba(2,132,199,0.35)']}
                    style={styles.logoBg}
                  >
                    <Ionicons name="flash" size={36} color="#5EEAD4" />
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => setAdminAccessVisible((v) => !v)}
                activeOpacity={1}
                accessibilityLabel="CHAMBA"
                disabled={showHeroExtras}
              >
                <Text style={[styles.appName, isCompactLayout && styles.appNameCompact]}>
                  CHAMBA
                </Text>
              </TouchableOpacity>

              <Text style={[styles.tagline, isCompactLayout && styles.taglineCompact]}>
                Encuentra personal confiable en minutos
              </Text>

              {showHeroExtras ? (
                <View style={styles.pilotChip}>
                  <View style={styles.pilotDot} />
                  <MaterialCommunityIcons name="rocket-launch-outline" size={14} color="#99F6E4" />
                  <Text style={styles.pilotText}>Modo Piloto · Acceso Express</Text>
                </View>
              ) : null}
            </Animated.View>

            <View
              style={[
                styles.subjectStage,
                {
                  height: isCompactLayout
                    ? LOGIN_SCREEN_LAYOUT.heroCardGap.compact
                    : LOGIN_SCREEN_LAYOUT.heroCardGap.wide,
                },
              ]}
            />

            <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOp,
                transform: [{ translateY: cardY }, { translateX: shakeX }],
              },
            ]}
          >
            <LinearGradient
              colors={[LOGIN_PRIMARY, LOGIN_PRIMARY]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardAccent}
            />

            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="log-in-outline" size={22} color={LOGIN_PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Ingresá tus datos</Text>
              </View>
            </View>

            <View style={styles.fields}>
              <PremiumField
                  label="Nombre completo"
                  icon="person-outline"
                  placeholder="Ej. Juan Pérez"
                  value={fullName}
                  onChangeText={setFullName}
                  onClearError={() => setNameErr('')}
                  error={nameErr}
                  autoCapitalize="words"
                  returnKeyType="next"
                />

              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.label}>Número de celular</Text>
                <View style={[fieldStyles.row, !!phoneErr && fieldStyles.rowError]}>
                  <View style={[fieldStyles.iconCircle, fieldStyles.phoneIconCircle]}>
                    <Ionicons name="call-outline" size={18} color={CHAMBA.blue} />
                  </View>
                  <Text style={fieldStyles.prefix} accessibilityLabel="Prefijo Nicaragua">
                    +505
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={(v) => {
                      const digits = v.replace(/\D/g, '').slice(0, 8);
                      setPhone(formatNicaPhone(digits));
                      setPhoneErr('');
                    }}
                    placeholder="8888-8888"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={9}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    style={[fieldStyles.input, fieldStyles.phoneLocalInput, textInputWebFocusStyle]}
                  />
                </View>
                {!!phoneErr ? (
                  <Text style={fieldStyles.errorText}>{phoneErr}</Text>
                ) : (
                  <Text style={fieldStyles.hint}>Nicaragua</Text>
                )}
              </View>

              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.label}>¿Cómo usarás CHAMBA?</Text>
                <ChambaSlidingToggle
                  options={ROLE_TOGGLE_OPTIONS}
                  active={role}
                  onChange={setRole}
                  cornerRadius={12}
                  activeFontWeight="600"
                />
                <Animated.Text style={[styles.roleHint, { opacity: roleHintOp }]}>
                  {roleHint}
                </Animated.Text>
              </View>
            </View>

            {!!error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel="Entrar a CHAMBA"
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor:
                        pressed && !isBusy ? LOGIN_PRIMARY_PRESSED : LOGIN_PRIMARY,
                    },
                    isBusy && styles.submitDisabled,
                  ]}
                >
                  {pendingAction === 'chamba' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name="flash"
                        size={18}
                        color="#FFFFFF"
                        style={styles.submitBtnIcon}
                      />
                      <Text style={styles.submitBtnText}>Entrar a CHAMBA</Text>
                    </>
                  )}
                </View>
              )}
            </Pressable>

            <TouchableOpacity
              style={styles.registerRow}
              onPress={() => navigation.navigate('Register')}
              disabled={isBusy}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>¿Primera vez en CHAMBA? </Text>
              <Text style={styles.registerLink}>Crear cuenta</Text>
            </TouchableOpacity>

            <Text style={styles.legalNote}>
              Al continuar aceptás los términos de uso. Tus datos solo se usan para identificarte.
            </Text>

            {adminAccessVisible && (
              <TouchableOpacity
                onPress={async () => {
                  setError(null);
                  setPendingAction('admin');
                  try {
                    await pilotSignIn('admin');
                  } catch (e: unknown) {
                    const msg =
                      e instanceof Error ? e.message : 'No se pudo entrar como administrador';
                    setError(msg);
                  } finally {
                    setPendingAction(null);
                  }
                }}
                disabled={isBusy}
                style={styles.adminBtnDiscreet}
                activeOpacity={0.6}
              >
                {pendingAction === 'admin' ? (
                  <ActivityIndicator color={CHAMBA.muted} size="small" />
                ) : (
                  <Text style={styles.adminBtnDiscreetText}>Acceso administrador</Text>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Field styles ──────────────────────────────────────────────────

const fieldStyles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: CHAMBA.navy,
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: CHAMBA.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    minHeight: 54,
  },
  rowFocused: {
    borderColor: CHAMBA.blue,
    backgroundColor: '#FFFFFF',
    shadowColor: CHAMBA.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  rowError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF2F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleFocused: {
    backgroundColor: '#E0F2FE',
  },
  phoneIconCircle: {
    backgroundColor: '#E0F2FE',
  },
  input: {
    flex: 1,
    color: CHAMBA.navy,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 12,
  },
  prefixBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  prefix: {
    color: CHAMBA.navy,
    fontSize: 16,
    fontWeight: '700',
    paddingRight: 4,
    letterSpacing: 0.2,
  },
  phoneLocalInput: {
    flex: 1,
    minWidth: 0,
  },
  hint: {
    color: CHAMBA.muted,
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '500',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
});

// ─── Screen styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAMBA.navy, overflow: 'hidden' },
  flexFill: { flex: 1 },
  bgImageCover: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? { objectFit: 'cover' as const, objectPosition: 'center center' }
      : {}),
  },
  bgTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: LOGIN_SCREEN_LAYOUT.scroll.paddingHorizontal,
    paddingTop:
      Platform.OS === 'ios'
        ? LOGIN_SCREEN_LAYOUT.scroll.paddingTop.ios
        : LOGIN_SCREEN_LAYOUT.scroll.paddingTop.default,
    paddingBottom: SPACING['2xl'],
  },
  layoutColumn: {
    flex: 1,
    minHeight: '100%',
  },
  hero: { alignItems: 'center', paddingTop: LOGIN_SCREEN_LAYOUT.hero.paddingTop.wide },
  heroCompact: {
    paddingTop: LOGIN_SCREEN_LAYOUT.hero.paddingTop.compact,
  },
  subjectStage: {
    width: '100%',
  },
  logoWrap: { marginBottom: SPACING.md },
  logoBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE['4xl'],
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: LOGIN_SCREEN_LAYOUT.hero.appNameMarginBottom.wide,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appNameCompact: {
    fontSize: 34,
    letterSpacing: 3,
    marginBottom: LOGIN_SCREEN_LAYOUT.hero.appNameMarginBottom.compact,
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: LOGIN_SCREEN_LAYOUT.hero.taglineMarginBottom.wide,
    paddingHorizontal: SPACING.md,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  taglineCompact: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    marginBottom: LOGIN_SCREEN_LAYOUT.hero.taglineMarginBottom.compact,
    paddingHorizontal: SPACING.lg,
  },
  pilotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  pilotDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  pilotText: { color: '#CCFBF1', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 22,
    padding: 20,
    paddingTop: 14,
    overflow: 'hidden',
    ...CARD_STEP_SHADOW,
  },
  cardAccent: {
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
    marginHorizontal: -4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CHAMBA.border,
  },
  cardHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: CHAMBA.navy,
  },
  fields: { gap: 16 },
  roleHint: {
    fontSize: 12,
    color: CHAMBA.muted,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { flex: 1, color: '#991B1B', fontSize: FONT_SIZE.sm, lineHeight: 20 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    width: '100%',
    height: 56,
    borderRadius: 12,
    backgroundColor: LOGIN_PRIMARY,
    marginVertical: 12,
    shadowColor: LOGIN_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', userSelect: 'none' } as Record<string, string>)
      : {}),
  },
  submitDisabled: { opacity: 0.75 },
  submitBtnIcon: {
    marginRight: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  registerText: { color: CHAMBA.muted, fontSize: FONT_SIZE.sm },
  registerLink: { color: CHAMBA.blue, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  legalNote: {
    color: CHAMBA.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 16,
  },
  adminBtnDiscreet: {
    alignSelf: 'center',
    marginTop: SPACING.sm,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  adminBtnDiscreetText: {
    color: CHAMBA.muted,
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.55,
  },
});
