import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback storage for web
const storage = Platform.OS === 'web' ? {
  async getItem(key: string) {
    return localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    localStorage.setItem(key, value);
  },
} : AsyncStorage;

const ONBOARDING_KEY = '@chamba_onboarding_completed';

interface Step {
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    title: 'Bienvenido a Chamba',
    description:
      'Te damos la bienvenida a Chamba. Conectamos tus necesidades del día a día con colaboradores y técnicos calificados en Nicaragua, de forma rápida y transparente.',
  },
  {
    title: 'Categorías Principales',
    description:
      'Aquí encontrarás nuestros servicios principales. Selecciona el área que necesitas para explorar las subcategorías disponibles.',
  },
  {
    title: 'Cotizaciones y Solicitudes',
    description:
      'Al elegir un servicio, podrás detallar lo que necesitas y solicitar una cotización a tu medida en pocos segundos.',
  },
  {
    title: 'Seguimiento y Chat en Vivo',
    description:
      'Desde aquí puedes chatear directamente con tu colaborador asignado y revisar el estado de tus solicitudes en tiempo real.',
  },
];

export const OnboardingTour: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  // Check persistence on mount
  useEffect(() => {
    (async () => {
      const completed = await storage.getItem(ONBOARDING_KEY);
      if (!completed) {
        setVisible(true);
      }
    })();
  }, []);

  const finish = async () => {
    await storage.setItem(ONBOARDING_KEY, 'true');
    setVisible(false);
  };

  const next = async () => {
    if (current + 1 < steps.length) {
      setCurrent(current + 1);
    } else {
      await finish();
    }
  };

  if (!visible) return null;

  const step = steps[current];

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container} accessibilityRole="dialog">
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
          <View style={styles.progress}>
            {steps.map((_s, i) => (
              <View
                key={i}
                style={[styles.dot, i === current && styles.activeDot]}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity onPress={finish} style={styles.skipButton}>
              <Text style={styles.skipLabel}>Saltar tour</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={next} style={styles.nextButton}>
              <Text style={styles.nextLabel}> {current + 1 === steps.length ? 'Comenzar' : 'Siguiente'} </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#222',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    color: '#555',
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#0066ff', // primary brand color
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skipButton: {
    padding: 8,
  },
  skipLabel: {
    color: '#888',
    fontSize: 14,
  },
  nextButton: {
    backgroundColor: '#0066ff', // primary brand color
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  nextLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
