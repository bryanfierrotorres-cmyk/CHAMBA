import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HOME_PALETTE, HOME_SOFT_SHADOW } from '@constants/clientHomeTheme';

export type HomeModeToggleValue = 'hogar' | 'empresa';

interface HomeModeToggleProps {
  value: HomeModeToggleValue;
  onChange: (value: HomeModeToggleValue) => void;
}

/**
 * Segmentado "Para tu hogar / Para tu negocio" — spec Home v1.1 exacta.
 * Distinto del patrón de ChambaSlidingToggle (pastilla rellena animada):
 * acá el tab activo es una pastilla BLANCA con ícono+texto azul, no un
 * relleno de color con texto blanco — por eso es un componente nuevo en
 * vez de reusar el compartido (que sí se sigue usando en Login/MyJobs/Wallet).
 */
export const HomeModeToggle: React.FC<HomeModeToggleProps> = ({ value, onChange }) => (
  <View style={styles.container}>
    <TouchableOpacity
      style={[styles.tab, value === 'hogar' && styles.tabActive]}
      activeOpacity={0.8}
      onPress={() => onChange('hogar')}
    >
      <Ionicons
        name="home"
        size={18}
        color={value === 'hogar' ? HOME_PALETTE.blue : HOME_PALETTE.midGray}
      />
      <Text style={[styles.label, value === 'hogar' ? styles.labelActive : styles.labelInactive]}>
        Para tu hogar
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.tab, value === 'empresa' && styles.tabActive]}
      activeOpacity={0.8}
      onPress={() => onChange('empresa')}
    >
      <Ionicons
        name="business"
        size={18}
        color={value === 'empresa' ? HOME_PALETTE.blue : HOME_PALETTE.midGray}
      />
      <Text style={[styles.label, value === 'empresa' ? styles.labelActive : styles.labelInactive]}>
        Para tu negocio
      </Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: HOME_PALETTE.filterBg,
    borderRadius: 18,
    padding: 6,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    ...HOME_SOFT_SHADOW,
  },
  label: {
    fontSize: 15,
  },
  labelActive: {
    fontWeight: '700',
    color: HOME_PALETTE.blue,
  },
  labelInactive: {
    fontWeight: '600',
    color: HOME_PALETTE.midGray,
  },
});
