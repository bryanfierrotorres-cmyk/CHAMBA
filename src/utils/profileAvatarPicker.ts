import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/** Abre la galería y devuelve la URI local de la imagen elegida. */
export async function pickProfileAvatarUri(): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Necesitamos acceso a tu galería para cambiar la foto de perfil.');
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

export function showProfileAvatarError(err: unknown): void {
  const message = err instanceof Error ? err.message : 'No se pudo subir la foto';
  if (Platform.OS === 'web') {
    window.alert(message);
    return;
  }
  Alert.alert('Error al subir foto', message);
}
