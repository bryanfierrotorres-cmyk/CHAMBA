import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@store/authStore';
import { CHAMBA } from '@constants/chambaUI';
import { FONT_SIZE, SPACING } from '@constants/theme';

interface AdminLoginModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ visible, onClose }) => {
  const { signIn, error, setError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      shake();
      return;
    }
    setIsLoading(true);
    try {
      await signIn(email.trim(), password);
      onClose();
    } catch {
      shake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.centered}
        >
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeX }] }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={CHAMBA.muted} />
            </TouchableOpacity>

            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark" size={32} color="#F59E0B" />
            </View>

            <Text style={styles.title}>Acceso Administrador</Text>
            <Text style={styles.subtitle}>Ingresá con tu cuenta de administrador</Text>

            {error ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Correo electrónico</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={CHAMBA.muted} />
                <TextInput
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); }}
                  placeholder="admin@chamba.com"
                  placeholderTextColor="#64748B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                  style={styles.input}
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={CHAMBA.muted} />
                <TextInput
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  placeholder="••••••••"
                  placeholderTextColor="#64748B"
                  secureTextEntry
                  style={styles.input}
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
              style={[styles.submitBtn, isLoading && styles.submitDisabled]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitText}>Ingresar como Admin</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    width: '100%',
    maxWidth: 380,
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  closeBtn: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 10,
    padding: 4,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: FONT_SIZE.sm,
    flex: 1,
  },
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: '#94A3B8',
    marginBottom: 6,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    padding: 0,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 14,
    marginTop: SPACING.sm,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});