import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADAR_BORDER, RADAR_MUTED, RADAR_TITLE } from '@components/worker/radar/radarTheme';

/**
 * Panel "Inicio" — bandeja de solicitudes que ya cumplieron una hora en el radar.
 * Por ahora se muestra vacío; recibirá las fichas que salgan del área del radar.
 */
export const RadarInboxScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.header}>Inicio</Text>

      <View style={styles.center}>
        <View style={styles.iconOrb}>
          <Ionicons name="time-outline" size={38} color={RADAR_MUTED} />
        </View>
        <Text style={styles.title}>Aún no hay solicitudes aquí</Text>
        <Text style={styles.subtitle}>
          Las solicitudes que pasen más de una hora en el radar se moverán a este
          panel para que las revises con calma.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: '800',
    color: RADAR_TITLE,
    letterSpacing: -0.4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 80,
  },
  iconOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: RADAR_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: RADAR_TITLE,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: RADAR_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
});
