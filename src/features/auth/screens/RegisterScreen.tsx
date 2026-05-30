import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { useAuthStore } from '@store/authStore';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/theme';
import { validateRegistration } from '@utils/validation';
import type { AuthStackParamList, UserRole } from '@/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

// ─── Role selector config ────────────────────────────────────────

interface RoleOption {
  role:     UserRole;
  emoji:    string;
  title:    string;
  subtitle: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role:     'worker',
    emoji:    '👷',
    title:    'Trabajador',
    subtitle: 'Acepta chambas y recibe el 95% del pago',
  },
  {
    role:     'admin',
    emoji:    '🏢',
    title:    'Empresa',
    subtitle: 'Publica excedentes de trabajo',
  },
];

// ─── Step indicator ──────────────────────────────────────────────

const StepIndicator: React.FC<{ step: number; total: number }> = ({ step, total }) => (
  <View style={styles.stepRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.stepDot,
          i < step && styles.stepDotDone,
          i === step - 1 && styles.stepDotActive,
        ]}
      />
    ))}
    <Text style={styles.stepLabel}>{step} de {total}</Text>
  </View>
);

// ─── Main screen ─────────────────────────────────────────────────

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { signUp, isLoading, error, setError } = useAuthStore();

  // Form state
  const [step, setStep]           = useState(1);
  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [password, setPassword]   = useState('');
  const [role, setRole]           = useState<UserRole>('worker');
  const [fieldError, setFieldError] = useState('');

  // Animation
  const slideX  = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    slideX.setValue(40);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(slideX,  { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => { setError(null); animateIn(); }, []);
  useEffect(() => animateIn(), [step]);

  // ── Validación por paso ───────────────────────────────────────
  const validateStep1 = () => {
    const r = validateRegistration(fullName, email, phone, password);
    if (!r.valid) { setFieldError(r.message); return false; }
    setFieldError('');
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const handleRegister = async () => {
    try {
      await signUp({ email, password, fullName, phone, role });
      // El RootNavigator reacciona al cambio de sesión automáticamente
    } catch {
      // Error ya está en el store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => (step === 1 ? navigation.goBack() : setStep(1))}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text.primary} />
          </TouchableOpacity>
          <StepIndicator step={step} total={2} />
        </View>

        <Animated.View
          style={{ opacity, transform: [{ translateX: slideX }] }}
        >
          {step === 1 ? (
            <Step1
              fullName={fullName}  setFullName={setFullName}
              email={email}        setEmail={setEmail}
              phone={phone}        setPhone={setPhone}
              password={password}  setPassword={setPassword}
              fieldError={fieldError}
              onNext={handleNextStep}
            />
          ) : (
            <Step2
              role={role}
              setRole={setRole}
              isLoading={isLoading}
              error={error}
              onRegister={handleRegister}
            />
          )}
        </Animated.View>

        {/* Login link — solo en step 1 */}
        {step === 1 && (
          <TouchableOpacity
            style={styles.loginRow}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
            <Text style={styles.loginLink}>Iniciar sesión</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Step 1: Datos personales ────────────────────────────────────

interface Step1Props {
  fullName: string; setFullName: (v: string) => void;
  email:    string; setEmail:    (v: string) => void;
  phone:    string; setPhone:    (v: string) => void;
  password: string; setPassword: (v: string) => void;
  fieldError: string;
  onNext: () => void;
}

const Step1: React.FC<Step1Props> = ({
  fullName, setFullName,
  email, setEmail,
  phone, setPhone,
  password, setPassword,
  fieldError, onNext,
}) => (
  <View style={styles.stepContent}>
    <Text style={styles.stepTitle}>Crea tu cuenta</Text>
    <Text style={styles.stepSub}>Únete a CHAMBA y empieza a ganar</Text>

    <View style={styles.fields}>
      <Input
        label="Nombre completo"
        placeholder="Juan García López"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        leftIcon="person-outline"
      />
      <Input
        label="Correo electrónico"
        placeholder="tu@correo.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        leftIcon="mail-outline"
      />
      <Input
        label="Teléfono (10 dígitos)"
        placeholder="5512345678"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        leftIcon="call-outline"
      />
      <Input
        label="Contraseña"
        placeholder="Mínimo 8 caracteres y un número"
        value={password}
        onChangeText={setPassword}
        isPassword
        leftIcon="lock-closed-outline"
      />
    </View>

    {fieldError ? (
      <View style={styles.errorBanner}>
        <Ionicons name="alert-circle-outline" size={15} color={COLORS.error} />
        <Text style={styles.errorText}>{fieldError}</Text>
      </View>
    ) : null}

    <Button
      label="Continuar"
      onPress={onNext}
      fullWidth
      size="lg"
      style={{ marginTop: SPACING.lg }}
      icon={<Ionicons name="arrow-forward" size={18} color={COLORS.text.inverse} />}
      iconPosition="right"
    />
  </View>
);

// ─── Step 2: Selección de rol ────────────────────────────────────

interface Step2Props {
  role:       UserRole;
  setRole:    (r: UserRole) => void;
  isLoading:  boolean;
  error:      string | null;
  onRegister: () => void;
}

const Step2: React.FC<Step2Props> = ({
  role, setRole, isLoading, error, onRegister,
}) => (
  <View style={styles.stepContent}>
    <Text style={styles.stepTitle}>¿Cuál es tu rol?</Text>
    <Text style={styles.stepSub}>Elige cómo usarás CHAMBA</Text>

    <View style={styles.roleGrid}>
      {ROLE_OPTIONS.map((opt) => {
        const selected = role === opt.role;
        return (
          <TouchableOpacity
            key={opt.role}
            onPress={() => setRole(opt.role)}
            activeOpacity={0.85}
            style={[styles.roleCard, selected && styles.roleCardSelected]}
          >
            {/* Checkmark */}
            {selected && (
              <View style={styles.roleCheck}>
                <Ionicons name="checkmark" size={12} color={COLORS.white} />
              </View>
            )}
            <Text style={styles.roleEmoji}>{opt.emoji}</Text>
            <Text style={[styles.roleTitle, selected && styles.roleTextSelected]}>
              {opt.title}
            </Text>
            <Text style={styles.roleSub}>{opt.subtitle}</Text>
          </TouchableOpacity>
        );
      })}
    </View>

    {/* Info banner worker */}
    {role === 'worker' && (
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
        <Text style={styles.infoText}>
          Los trabajadores requieren aprobación del admin antes de aceptar chambas.
        </Text>
      </View>
    )}

    {/* Error */}
    {error && (
      <View style={styles.errorBanner}>
        <Ionicons name="alert-circle-outline" size={15} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )}

    <Button
      label={isLoading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
      onPress={onRegister}
      isLoading={isLoading}
      fullWidth
      size="lg"
      style={{ marginTop: SPACING.lg }}
    />
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg.primary,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING['2xl'],
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border.default,
  },
  stepDotDone: {
    backgroundColor: COLORS.brand[600],
  },
  stepDotActive: {
    backgroundColor: COLORS.brand[500],
    width: 44,
  },
  stepLabel: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    marginLeft: 4,
  },
  // Step content
  stepContent: {
    gap: 0,
  },
  stepTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE['2xl'],
    fontWeight: '800',
    marginBottom: 4,
  },
  stepSub: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.md,
    marginBottom: SPACING.xl,
  },
  fields: {
    gap: SPACING.md,
  },
  // Role cards
  roleGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  roleCard: {
    flex: 1,
    backgroundColor: COLORS.bg.card,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.border.subtle,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
    position: 'relative',
  },
  roleCardSelected: {
    borderColor: COLORS.brand[500],
    backgroundColor: '#F0FDF4',
  },
  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  roleTitle: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  roleTextSelected: {
    color: COLORS.brand[300],
  },
  roleSub: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#1e40af',
    marginTop: SPACING.xs,
  },
  infoText: {
    color: '#93c5fd',
    fontSize: FONT_SIZE.xs,
    flex: 1,
    lineHeight: 18,
  },
  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#450a0a',
    borderRadius: 10,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: FONT_SIZE.sm,
    flex: 1,
  },
  // Bottom login link
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  loginText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.md,
  },
  loginLink: {
    color: COLORS.brand[400],
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});
