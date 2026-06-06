import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CHAMBA } from '@constants/chambaUI';
import { M3 } from '@constants/workerTheme';

interface Props {
  onPress: () => void;
  readOnly?: boolean;
  variant?: 'client' | 'worker';
}

export const JobChatEntryButton: React.FC<Props> = ({
  onPress,
  readOnly = false,
  variant = 'client',
}) => {
  const accent = variant === 'worker' ? M3.primary : CHAMBA.blue;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, { borderColor: `${accent}44` }]}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={readOnly ? 'Ver mensajes del servicio' : 'Abrir chat del servicio'}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${accent}14` }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={accent} />
      </View>
      <Text style={[styles.label, { color: accent }]}>Msj</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
