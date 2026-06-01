import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView,
  Platform, ScrollView, TextInput, ActivityIndicator,
  Image, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/theme';
import type { UserRole } from '@/types';

const LOGIN_BG = require('../../../../assets/login-hero-bg.png');

/** Por debajo de este ancho usamos contain para no recortar a los personajes. */
const COMPACT_BREAKPOINT = 640;

// ─── Nicaragua phone validation ───────────────────────────────────────────────
// Valid prefixes: 2 (landline), 5, 7, 8 (mobile). Total: 8 digits.
const isValidNicaPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 8 && /^[2578]/.test(digits);
};

// Format as XXXX-XXXX while typing
const formatPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

// ─── Role selector pill ───────────────────────────────────────────────────────

interface RolePillProps { role: UserRole; onChange: (r: UserRole) => void; }

const RolePill: React.FC<RolePillProps> = ({ role, onChange }) => {
  const ROLES: { value: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'client', label: 'Cliente',    icon: 'person-outline' },
    { value: 'worker', label: 'Trabajador', icon: 'briefcase-outline' },
  ];
  return (
    <View style={rStyles.wrap}>
      {ROLES.map((r) => {
        const active = role === r.value;
        return (
          <TouchableOpacity
            key={r.value}
            onPress={() => onChange(r.value)}
            style={[rStyles.pill, active && rStyles.pillActive]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={r.icon}
              size={15}
              color={active ? '#FFF' : COLORS.text.secondary}
            />
            <Text style={[rStyles.label, active && rStyles.labelActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const rStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg.primary,
    borderRadius: BORDER_RADIUS.full,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border.subtle,
  },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: BORDER_RADIUS.full,
  },
  pillActive: { backgroundColor: COLORS.brand[500] },
  label:      { color: COLORS.text.secondary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  labelActive:{ color: '#FFF', fontWeight: '700' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export const LoginScreen: React.FC = () => {
  const { width: screenWidth } = useWindowDimensions();
  const isCompactLayout = screenWidth < COMPACT_BREAKPOINT;
  const heroImageHeight = Math.min(screenWidth * 0.58, 300);

  const { phoneSignIn, pilotSignIn, isLoading, error, setError } = useAuthStore();

  const [fullName,   setFullName]   = useState('');
  const [phone,      setPhone]      = useState('');
  const [role,       setRole]       = useState<UserRole>('client');
  const [nameErr,    setNameErr]    = useState('');
  const [phoneErr,   setPhoneErr]   = useState('');

  // Entrance animations
  const heroOp  = useRef(new Animated.Value(0)).current;
  const heroY   = useRef(new Animated.Value(-24)).current;
  const cardOp  = useRef(new Animated.Value(0)).current;
  const cardY   = useRef(new Animated.Value(40)).current;
  const shakeX  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setError(null);
    Animated.parallel([
      Animated.timing(heroOp, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(heroY,  { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(cardOp, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(cardY,  { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();

  const validate = () => {
    let valid = true;
    setNameErr('');
    setPhoneErr('');

    if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
      setNameErr('Ingresa tu nombre completo (nombre y apellido)');
      valid = false;
    }
    if (!isValidNicaPhone(phone)) {
      setPhoneErr('Celular inválido — ingresa 8 dígitos (ej. 8888-8888)');
      valid = false;
    }
    return valid;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validate()) { shake(); return; }
    try {
      await phoneSignIn(fullName.trim(), phone, role);
    } catch {
      shake();
    }
  };

  return (
    <View style={styles.root}>
      <Image
        source={LOGIN_BG}
        accessibilityIgnoresInvertColors
        style={
          isCompactLayout
            ? [styles.bgImageCompact, { height: heroImageHeight }]
            : styles.bgImageCover
        }
        resizeMode={isCompactLayout ? 'contain' : 'cover'}
      />
      <View
        style={[
          styles.bgOverlay,
          isCompactLayout && { height: heroImageHeight },
        ]}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isCompactLayout && { paddingTop: Math.min(heroImageHeight * 0.22, 56) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────────── */}
        <Animated.View style={[styles.hero, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoBg}>
              <Ionicons name="flash" size={36} color={COLORS.brand[300]} />
            </View>
          </View>
          <Text style={styles.appName}>CHAMBA</Text>
          <Text style={styles.tagline}>Conectamos tu necesidad{'\n'}con el mejor trabajador</Text>

          {/* Pilot chip */}
          <View style={styles.pilotChip}>
            <View style={styles.pilotDot} />
            <Text style={styles.pilotText}>Modo Piloto Activo · Acceso Express</Text>
          </View>
        </Animated.View>

        {/* ── Form card ─────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity:   cardOp,
              transform: [{ translateY: cardY }, { translateX: shakeX }],
            },
          ]}
        >
          <Text style={styles.cardTitle}>Ingresa tus datos</Text>
          <Text style={styles.cardSub}>No necesitas contraseña ni correo.</Text>

          {/* Nombre completo */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Nombre Completo</Text>
            <View style={[styles.inputRow, !!nameErr && styles.inputRowError]}>
              <Ionicons name="person-outline" size={18} color={COLORS.text.muted} />
              <TextInput
                value={fullName}
                onChangeText={(v) => { setFullName(v); setNameErr(''); }}
                placeholder="Ej. Juan Pérez"
                placeholderTextColor={COLORS.text.muted}
                autoCapitalize="words"
                returnKeyType="next"
                style={styles.textInput}
              />
            </View>
            {!!nameErr && <Text style={styles.fieldError}>{nameErr}</Text>}
          </View>

          {/* Número de celular */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Número de Celular</Text>
            <View style={[styles.inputRow, !!phoneErr && styles.inputRowError]}>
              <Ionicons name="call-outline" size={18} color={COLORS.text.muted} />
              <Text style={styles.prefix}>+505</Text>
              <TextInput
                value={phone}
                onChangeText={(v) => { setPhone(formatPhone(v)); setPhoneErr(''); }}
                placeholder="8888-8888"
                placeholderTextColor={COLORS.text.muted}
                keyboardType="phone-pad"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                style={styles.textInput}
              />
            </View>
            {!!phoneErr && <Text style={styles.fieldError}>{phoneErr}</Text>}
          </View>

          {/* Role selector */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>¿Cómo usarás CHAMBA?</Text>
            <RolePill role={role} onChange={setRole} />
          </View>

          {/* Global error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color="#991B1B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
            style={[styles.submitBtn, isLoading && styles.submitBtnLoading]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="flash" size={20} color="#FFF" />
                <Text style={styles.submitBtnText}>Entrar a CHAMBA ⚡</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Legal note */}
          <Text style={styles.legalNote}>
            Al continuar aceptas los términos de uso de la plataforma.
            Tus datos solo se usan para identificarte.
          </Text>

          {/* Acceso administrador (piloto) */}
          <TouchableOpacity
            onPress={async () => {
              setError(null);
              try {
                await pilotSignIn('admin');
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'No se pudo entrar como administrador';
                setError(msg);
              }
            }}
            disabled={isLoading}
            style={styles.adminBtn}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.brand[500]} size="small" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.brand[500]} />
                <Text style={styles.adminBtnText}>Entrar como Administrador</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg.navy, overflow: 'hidden' },
  flexFill: { flex: 1 },
  /** Escritorio / tablet ancha: foto a pantalla completa */
  bgImageCover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? { objectFit: 'cover' as const, objectPosition: 'center center' }
      : {}),
  },
  /** Móvil: ancho 100 %, contain para mostrar ambas personas */
  bgImageCompact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    alignSelf: 'center',
    ...(Platform.OS === 'web'
      ? { objectFit: 'contain' as const, objectPosition: 'top center' }
      : {}),
  },
  /** Tinte oscuro sobre la foto para que el hero y el logo sigan leyéndose bien */
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: SPACING['2xl'],
  },

  // ── Hero
  hero: { alignItems: 'center', marginBottom: SPACING.xl },
  logoWrap: { marginBottom: SPACING.md },
  logoBg: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  appName: {
    color: '#FFFFFF', fontSize: FONT_SIZE['4xl'],
    fontWeight: '900', letterSpacing: 4, marginBottom: 8,
  },
  tagline: {
    color: COLORS.brand[200], fontSize: FONT_SIZE.md,
    textAlign: 'center', lineHeight: 24, marginBottom: SPACING.lg,
  },
  pilotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  pilotDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  pilotText: { color: COLORS.brand[200], fontSize: FONT_SIZE.xs, fontWeight: '600' },

  // ── Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 16,
  },
  cardTitle: {
    color: COLORS.text.primary, fontSize: FONT_SIZE.xl,
    fontWeight: '900', marginBottom: 4,
  },
  cardSub: {
    color: COLORS.text.muted, fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.lg,
  },

  // ── Fields
  fieldWrap: { marginBottom: SPACING.md },
  fieldLabel: {
    color: COLORS.text.primary, fontSize: FONT_SIZE.sm,
    fontWeight: '700', marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bg.primary,
    borderRadius: 14, height: 52,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.border.subtle,
  },
  inputRowError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  prefix: { color: COLORS.text.muted, fontSize: FONT_SIZE.md, fontWeight: '600' },
  textInput: { flex: 1, color: COLORS.text.primary, fontSize: FONT_SIZE.md },
  fieldError: { color: '#EF4444', fontSize: FONT_SIZE.xs, marginTop: 4, fontWeight: '500' },

  // ── Error box
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#991B1B', fontSize: FONT_SIZE.sm, flex: 1, lineHeight: 20 },

  // ── Submit button (pill, blue)
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.brand[500],
    borderRadius: BORDER_RADIUS.full, height: 56,
    marginTop: SPACING.sm,
    shadowColor: COLORS.brand[500],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  submitBtnLoading: { backgroundColor: COLORS.brand[300], shadowOpacity: 0 },
  submitBtnText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '800' },

  // ── Legal
  legalNote: {
    color: COLORS.text.muted, fontSize: 10,
    textAlign: 'center', marginTop: SPACING.md, lineHeight: 16,
  },
  adminBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               SPACING.sm,
    marginTop:         SPACING.md,
    paddingVertical:   SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius:      BORDER_RADIUS.full,
    borderWidth:       1.5,
    borderColor:       COLORS.brand[300],
    backgroundColor:   COLORS.brand[50],
  },
  adminBtnText: {
    color:      COLORS.brand[600],
    fontSize:   FONT_SIZE.sm,
    fontWeight: '800',
  },
});
