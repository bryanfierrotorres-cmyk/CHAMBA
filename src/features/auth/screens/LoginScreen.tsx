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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
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
type LoginRoute = RouteProp<AuthStackParamList, 'Login'>;

// Alineado con el azul de marca del componente Button compartido (colors.brand[500]/[600]).
const LOGIN_PRIMARY = '#3B82F6';
const LOGIN_PRIMARY_PRESSED = '#2563EB';

const LOGIN_BG = require('../../../../assets/chamba_logo.png');

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

import { AdminLoginModal } from './AdminLoginModal';

// ─── Main screen ───────────────────────────────────────────────────

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginNav>();
  const route = useRoute<LoginRoute>();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isCompactLayout = screenWidth < COMPACT_BREAKPOINT;

  const { error, setError, registerPhoneProfile, requestPhoneLoginOtp } = useAuthStore();
  const [adminLoginVisible, setAdminLoginVisible] = useState(false);
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fullName, setFullName] = useState('');
  // Si venimos de Registro, el celular ya se escribió hace segundos —
  // no hacer que la persona lo vuelva a tipear.
  const [phone, setPhone] = useState(() => formatNicaPhone(route.params?.prefillPhone ?? ''));
  const [role, setRole] = useState<UserRole>('client');
  const [nameErr, setNameErr] = useState('');
  const [phoneErr, setPhoneErr] = useState('');

  const heroOp = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(-24)).current;
  const cardOp = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(40)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const roleHintOp = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

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

  const handleLogoTap = () => {
    logoTapCount.current += 1;
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    logoTapTimer.current = setTimeout(() => { logoTapCount.current = 0; }, 2000);
    if (logoTapCount.current >= 2) {
      logoTapCount.current = 0;
      setAdminLoginVisible(true);
    }
  };

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();

  const handlePressIn = () => {
    Animated.spring(btnScale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 30,
      bounciness: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(btnScale, {
      toValue: Platform.OS === 'web' ? 1.02 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
  };

  const handleHoverIn = () => {
    if (Platform.OS !== 'web') return;
    Animated.spring(btnScale, {
      toValue: 1.02,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handleHoverOut = () => {
    if (Platform.OS !== 'web') return;
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

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
    return validatePhone();
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validateLogin()) {
      shake();
      return;
    }

    const cleanPhone = getPhoneDigits();

    try {
      await requestPhoneLoginOtp(cleanPhone);
      navigation.navigate('VerifyOtp', { phone: cleanPhone, role });
    } catch {
      shake();
    }
  };

  const roleHint =
    role === 'client'
      ? 'Solicitá servicios para tu hogar o negocio'
      : 'Aceptá chambas y cobrá el 95% de cada trabajo';

  const bgImageStyle = [
    styles.bgImageCover,
    Platform.OS === 'web'
      ? {} // Web positioning is handled by injected CSS below
      : {
          width: screenWidth,
          height: screenHeight,
          transform: [
            { scale: 1.25 },
            { translateX: screenWidth * -0.075 }, // aprox 3cm a la izquierda relativos
            { translateY: screenHeight * -0.06 }, // aprox 5cm arriba relativos
          ],
        },
  ];

  const WebStyle = Platform.OS === 'web'
    ? React.createElement('style', null, `
        [data-testid="login-bg-image"],
        [data-testid="login-bg-image"] img,
        [data-testid="login-bg-image"] div {
          object-position: 60% 0% !important;
          background-position: 60% 0% !important;
        }
      `)
    : null;

  const showHeroExtras = !isCompactLayout;

  return (
    <View style={styles.root}>
      {WebStyle}
      <Image
        testID="login-bg-image"
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
              <TouchableOpacity
                style={styles.logoWrap}
                onPress={handleLogoTap}
                activeOpacity={0.8}
                accessibilityLabel="Logo CHAMBA"
              >
                  <Image
                    source={require('../../../../assets/images/icon.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>

                <Text style={[styles.appName, isCompactLayout && styles.appNameCompact]}>
                  CHAMBA
                </Text>

              <Text style={[styles.tagline, isCompactLayout && styles.taglineCompact]}>
                Encuentra personal confiable en minutos
              </Text>
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
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onHoverIn={handleHoverIn}
              onHoverOut={handleHoverOut}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Entrar a CHAMBA"
              style={{ width: '100%', alignItems: 'center' }}
            >
              <Animated.View style={[styles.submitBtn, { transform: [{ scale: btnScale }] }]}>
                <Ionicons name="flash" size={18} color="#FFFFFF" style={styles.submitBtnIcon} />
                <Text style={styles.submitBtnText}>Entrar a CHAMBA</Text>
              </Animated.View>
            </Pressable>

            <TouchableOpacity
              style={styles.registerRow}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>¿Primera vez en CHAMBA? </Text>
              <Text style={styles.registerLink}>Crear cuenta</Text>
            </TouchableOpacity>

            <Text style={styles.legalNote}>
              Al continuar aceptás los términos de uso. Tus datos solo se usan para identificarte.
            </Text>
          </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AdminLoginModal
        visible={adminLoginVisible}
        onClose={() => setAdminLoginVisible(false)}
      />
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 24,
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
});
