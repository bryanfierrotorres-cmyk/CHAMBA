import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INICIO, CARD_RADIUS, INNER_RADIUS } from './inicioTheme';

interface PromoBannerProps {
  recommendedRadiusKm: number;
  onPress: () => void;
}

export const PromoBanner: React.FC<PromoBannerProps> = ({ recommendedRadiusKm, onPress }) => (
  <View style={styles.banner}>
    <View style={styles.left}>
      <View style={styles.iconCircle}>
        <Ionicons name="disc" size={16} color={INICIO.red} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>Aumenta tus oportunidades</Text>
        <Text style={styles.desc}>
          {`Amplía tu radio a ${recommendedRadiusKm} km y comprueba hasta 40% más solicitudes.`}
        </Text>
      </View>
    </View>
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button">
      <Text style={styles.buttonText}>Ampliar radio</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: INICIO.amberSurface,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: INICIO.amberSoft,
    padding: 16,
  },
  left: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: INICIO.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textCol: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: INICIO.textStrong, marginBottom: 2 },
  desc: { fontSize: 12, color: INICIO.textMedium, lineHeight: 16 },
  button: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: INNER_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexShrink: 0,
  },
  buttonText: { fontSize: 12, fontWeight: '600', color: INICIO.blue },
});
