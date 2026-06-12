import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@store/authStore';
import { CHAMBA } from '@constants/chambaUI';
import { FONT_SIZE, SPACING } from '@constants/theme';
import type { AuthStackParamList, UserRole } from '@/types';

type VerifyOtpNav = NativeStackNavigationProp<AuthStackParamList, 'VerifyOtp'>;
type VerifyOtpRoute = RouteProp<AuthStackParamList, 'VerifyOtp'>;

export const VerifyOtpScreen: React.FC = () => {
  const navigation = useNavigation<VerifyOtpNav>();
  const route = useRoute<VerifyOtpRoute>();
  const { phone, role } = route.params;

  const { verifyPhoneLoginOtp, requestPhoneLoginOtp, error, setError } = useAuthStore();

  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const shakeX = useRef(new Animated.Value(0)).current;
  const fadeOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();

  const handleVerify = async () => {
    setError(null);
    const digits = code.replace(/\D/g, '');
    if (digits.length < 4) {
      shake();
      return;
    }
    setIsVerifying(true);
    try {
      await verifyPhoneLoginOtp(phone, digits, role);
    } catch {
      shake();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError(null);
    setIsSending(true);
    try {
      await requestPhoneLoginOtp(phone);
      setResendTimer(60);
    } catch {
      shake();
    } finally {
      setIsSending(false);
    }
  };

  const formatPhone = (p: string) => {
    if (p.length === 8) return `${p.slice(0, 4)}-${p.slice(4)}`;
    return p;
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(13,148,136,0.15)', 'transparent']}
        style={styles.bgGradient}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: fadeOp }]}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.iconWrap}>
              <Ionicons name="chatbox-ellipses-outline" size={48} color={CHAMBA.blue} />
            </View>

            <Text style={styles.title}>Ingresá el código</Text>
            <Text style={styles.subtitle}>
              Te enviamos un SMS al{' '}
              <Text style={styles.phone}>+505 {formatPhone(phone)}</Text>
            </Text>

            {error ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Animated.View style={[styles.codeRow, { transform: [{ translateX: shakeX }] }]}>
              <TextInput
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
                placeholder="Código de 6 dígitos"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={styles.codeInput}
                onSubmitEditing={handleVerify}
              />
            </Animated.View>

            <TouchableOpacity
              onPress={handleVerify}
              disabled={isVerifying || code.length < 4}
              activeOpacity={0.8}
              style={[
                styles.submitBtn,
                (isVerifying || code.length < 4) && styles.submitDisabled,
              ]}
            >
              {isVerifying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Verificar y entrar</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResend}
              disabled={isSending || resendTimer > 0}
              activeOpacity={0.7}
              style={styles.resendRow}
            >
              {isSending ? (
                <ActivityIndicator color={CHAMBA.blue} size="small" />
              ) : (
                <Text style={[styles.resendText, resendTimer > 0 && styles.resendDisabled]}>
                  {resendTimer > 0
                    ? `Reenviar código en ${resendTimer}s`
                    : 'Reenviar código'}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  flexFill: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  content: {
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    zIndex: 10,
    padding: 8,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(13,148,136,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: CHAMBA.white,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: CHAMBA.muted,
    marginBottom: SPACING.xl,
    textAlign: 'center',
    lineHeight: 20,
  },
  phone: {
    color: CHAMBA.white,
    fontWeight: '600',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: SPACING.lg,
    width: '100%',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: FONT_SIZE.sm,
    flex: 1,
  },
  codeRow: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 18,
    fontSize: 28,
    fontWeight: '700',
    color: CHAMBA.white,
    textAlign: 'center',
    letterSpacing: 8,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHAMBA.blue,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: SPACING.md,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  resendRow: {
    padding: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendText: {
    color: CHAMBA.blue,
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
  resendDisabled: {
    color: CHAMBA.muted,
  },
});