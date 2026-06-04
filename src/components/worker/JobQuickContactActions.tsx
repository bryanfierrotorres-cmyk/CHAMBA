import React from 'react';
import { View, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CHAMBA } from '@constants/chambaUI';
import { openWhatsAppSupport } from '@utils/whatsappSupport';

interface Props {
  clientPhone?: string | null;
  jobTitle?: string;
  compact?: boolean;
}

export const JobQuickContactActions: React.FC<Props> = ({
  clientPhone,
  jobTitle,
  compact = false,
}) => {
  const handleCall = () => {
    if (!clientPhone) {
      Alert.alert('Sin número', 'El cliente no tiene teléfono registrado.');
      return;
    }
    Linking.openURL(`tel:${clientPhone}`).catch(() =>
      Alert.alert('Error', 'No se pudo abrir el marcador.'),
    );
  };

  const handleSupportChat = () => {
    const context = jobTitle
      ? `Hola, necesito ayuda con mi chamba "${jobTitle}" en CHAMBA.`
      : undefined;
    void openWhatsAppSupport(context);
  };

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <TouchableOpacity
        onPress={handleCall}
        style={[styles.btn, styles.btnCall]}
        accessibilityLabel="Llamar al cliente"
        accessibilityRole="button"
      >
        <Ionicons name="call" size={compact ? 18 : 20} color="#FFF" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleSupportChat}
        style={[styles.btn, styles.btnChat]}
        accessibilityLabel="Chat de asistencia CHAMBA"
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-ellipses" size={compact ? 18 : 20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  rowCompact: {
    gap: 8,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCall: {
    backgroundColor: CHAMBA.navy,
  },
  btnChat: {
    backgroundColor: '#25D366',
  },
});
