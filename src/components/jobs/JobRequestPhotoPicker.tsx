import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';

interface Props {
  photoUri: string | null;
  onPhotoChange: (uri: string | null) => void;
  disabled?: boolean;
  /** Estilo compacto para wizard — solo botón "Agregar foto". */
  variant?: 'default' | 'minimal';
}

export const JobRequestPhotoPicker: React.FC<Props> = ({
  photoUri,
  onPhotoChange,
  disabled = false,
  variant = 'default',
}) => {
  const [picking, setPicking] = useState(false);

  const pickPhoto = async () => {
    if (disabled) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para adjuntar la imagen.');
      return;
    }

    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets[0]?.uri) {
        onPhotoChange(result.assets[0].uri);
      }
    } finally {
      setPicking(false);
    }
  };

  const isMinimal = variant === 'minimal';

  return (
    <View style={[styles.wrap, isMinimal && styles.wrapMinimal]}>
      {!isMinimal ? (
        <>
          <Text style={chambaStyles.formLabel}>Foto del servicio (opcional)</Text>
          <Text style={styles.hint}>
            Ayuda al técnico a ver el estado o la magnitud del trabajo antes de aceptar.
          </Text>
        </>
      ) : null}

      {photoUri ? (
        <View style={[styles.previewWrap, isMinimal && styles.previewMinimal]}>
          <Image source={{ uri: photoUri }} style={[styles.preview, isMinimal && styles.previewSmall]} resizeMode="cover" />
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={pickPhoto}
              disabled={disabled || picking}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={18} color={CHAMBA.blue} />
              <Text style={styles.actionBtnText}>Cambiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onPhotoChange(null)}
              disabled={disabled}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text style={[styles.actionBtnText, styles.removeText]}>Quitar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addBtn, isMinimal && styles.addBtnMinimal]}
          onPress={pickPhoto}
          disabled={disabled || picking}
          activeOpacity={0.85}
        >
          {picking ? (
            <ActivityIndicator color={CHAMBA.blue} />
          ) : isMinimal ? (
            <>
              <Ionicons name="image-outline" size={18} color="#1E293B" />
              <Text style={styles.addBtnMinimalText}>Agregar foto</Text>
            </>
          ) : (
            <>
              <View style={styles.addIconWrap}>
                <Ionicons name="camera" size={24} color={CHAMBA.blue} />
              </View>
              <Text style={styles.addBtnTitle}>Agregar foto</Text>
              <Text style={styles.addBtnSub}>Toca para elegir desde la galería</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  hint: {
    color: CHAMBA.muted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    marginTop: -2,
  },
  addBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: CHAMBA.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E0F2FE',
    borderStyle: 'dashed',
    paddingVertical: 20,
    paddingHorizontal: 16,
    ...CARD_STEP_SHADOW,
  },
  addIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  addBtnTitle: {
    color: CHAMBA.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  addBtnSub: {
    color: CHAMBA.muted,
    fontSize: 12,
  },
  previewWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: CHAMBA.white,
    ...CARD_STEP_SHADOW,
  },
  preview: {
    width: '100%',
    height: 200,
    backgroundColor: CHAMBA.border,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnText: {
    color: CHAMBA.blue,
    fontSize: 13,
    fontWeight: '600',
  },
  removeText: { color: '#DC2626' },
  wrapMinimal: { marginBottom: 0, marginTop: 4 },
  addBtnMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'solid',
    backgroundColor: '#F9FAFB',
    ...CARD_STEP_SHADOW,
  },
  addBtnMinimalText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600',
  },
  previewMinimal: { marginTop: 8 },
  previewSmall: { height: 140 },
});
