import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CHAMBA, CARD_STEP_SHADOW } from '@constants/chambaUI';
import { textInputWebFocusStyle } from '@constants/textInputFocus';
import { formatCurrency } from '@utils/formatters';

export interface CustomServiceCardRef {
  focusDescription: () => void;
}

interface Props {
  onSendRequest: (description: string, price: number) => void;
  disabled?: boolean;
}

const MINIMUM_PRICE = 380;

export const CustomServiceCard = forwardRef<CustomServiceCardRef, Props>(({ onSendRequest, disabled }, ref) => {
  const [description, setDescription] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const descInputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => ({
    focusDescription: () => {
      descInputRef.current?.focus();
    }
  }));

  const priceNum = parseInt(priceStr.replace(/\D/g, ''), 10) || 0;
  const isPriceValid = priceNum >= MINIMUM_PRICE;
  const isDescValid = description.trim().length > 0;
  const canSubmit = isPriceValid && isDescValid && !disabled;

  const prevValidRef = useRef(isPriceValid);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeUnlock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!prevValidRef.current && isPriceValid) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.05, duration: 80, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]),
        Animated.timing(fadeUnlock, { toValue: 1, duration: 250, useNativeDriver: true })
      ]).start();
    } else if (prevValidRef.current && !isPriceValid) {
      Animated.timing(fadeUnlock, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
    prevValidRef.current = isPriceValid;
  }, [isPriceValid, scaleAnim, fadeUnlock]);

  const handleSend = () => {
    if (canSubmit) {
      onSendRequest(description.trim(), priceNum);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="construct" size={20} color={CHAMBA.white} />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Haz una solicitud personalizada</Text>
          <Text style={styles.subtitle}>¿No encontrás lo que buscás? Describílo a detalle.</Text>
        </View>
      </View>

      <Text style={styles.label}>¿Qué necesitas?</Text>
      <TextInput
        ref={descInputRef}
        style={[styles.textArea, textInputWebFocusStyle]}
        placeholder="Ej: Necesito un técnico que repare una refrigeradora marca Samsung que no congela abajo..."
        placeholderTextColor={CHAMBA.muted}
        multiline
        value={description}
        onChangeText={setDescription}
        editable={!disabled}
      />

      <Text style={styles.label}>Tu presupuesto sugerido (C$)</Text>
      <View style={styles.priceContainer}>
        <View style={styles.priceInputRow}>
          <Text style={styles.currencyPrefix}>C$</Text>
          <TextInput
            style={[styles.priceInput, textInputWebFocusStyle]}
            placeholder="400"
            placeholderTextColor={CHAMBA.muted}
            keyboardType="number-pad"
            value={priceStr}
            onChangeText={setPriceStr}
            editable={!disabled}
          />
        </View>
        {priceStr.trim().length > 0 && !isPriceValid ? (
          <Text style={styles.errorText}>
            El precio mínimo para servicios personalizados es de C$ {MINIMUM_PRICE}
          </Text>
        ) : (
          <Text style={styles.helperText}>
            Precio sugerido: C$ 400 en adelante para una aceptación más rápida
          </Text>
        )}
      </View>

      <TouchableOpacity
        onPress={handleSend}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        <Animated.View style={[
          styles.submitBtn,
          !canSubmit && styles.submitBtnDisabled,
          { transform: [{ scale: scaleAnim }] }
        ]}>
          <Text style={styles.submitBtnText}>Enviar Solicitud</Text>
          <View style={styles.iconCrossfade}>
            <Animated.View style={{ position: 'absolute', opacity: fadeUnlock.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
              <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.7)" />
            </Animated.View>
            <Animated.View style={{ position: 'absolute', opacity: fadeUnlock }}>
              <Ionicons name="paper-plane" size={18} color={CHAMBA.white} />
            </Animated.View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 20,
    padding: 20,
    marginTop: 24,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...CARD_STEP_SHADOW,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: CHAMBA.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: CHAMBA.navy,
  },
  subtitle: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: CHAMBA.navy,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  priceContainer: {
    marginBottom: 20,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: CHAMBA.navy,
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: CHAMBA.navy,
    paddingVertical: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 6,
  },
  submitBtn: {
    backgroundColor: CHAMBA.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    color: CHAMBA.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  iconCrossfade: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
