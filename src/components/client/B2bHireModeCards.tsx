import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';

export type B2bHireMode = 'horas' | 'jornadas';

interface B2bHireModeCardsProps {
  value: B2bHireMode;
  onChange: (mode: B2bHireMode) => void;
}

/**
 * Selector Por Horas / Por Jornadas (tab Para tu Negocio).
 * Texto a la izquierda, icono a la derecha — dos tarjetas en fila al 50%.
 */
export const B2bHireModeCards: React.FC<B2bHireModeCardsProps> = ({ value, onChange }) => (
  <View style={styles.row}>
    <ChambaPressable
      style={[styles.card, value === 'horas' && styles.cardActive]}
      onPress={() => onChange('horas')}
    >
      <View style={styles.textCol}>
        <Text style={styles.title}>Por Horas</Text>
        <Text style={styles.subtitle}>Flexibilidad total</Text>
      </View>
      <View style={styles.iconHoras}>
        <Ionicons name="time" size={22} color="#FFFFFF" />
      </View>
    </ChambaPressable>

    <ChambaPressable
      style={[styles.card, value === 'jornadas' && styles.cardActive]}
      onPress={() => onChange('jornadas')}
    >
      <View style={styles.textCol}>
        <Text style={styles.title}>Por Jornadas</Text>
        <Text style={styles.subtitle}>Jornada completa</Text>
      </View>
      {value === 'jornadas' ? (
        <View style={styles.iconJornadasActive}>
          <Ionicons name="calendar" size={22} color="#FFFFFF" />
        </View>
      ) : (
        <View style={styles.iconJornadasIdle}>
          <Ionicons name="calendar-outline" size={24} color={CHAMBA.blue} />
        </View>
      )}
    </ChambaPressable>
  </View>
);

const GAP = 12;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: 20,
    width: '100%',
  },
  card: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    minHeight: 88,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...CARD_STEP_SHADOW,
  },
  cardActive: {
    borderColor: CHAMBA.cyan,
  },
  textCol: {
    flex: 1,
    paddingRight: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: CHAMBA.navy,
  },
  subtitle: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 4,
    fontWeight: '400',
  },
  iconHoras: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconJornadasIdle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconJornadasActive: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
