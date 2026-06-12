import { Alert, Platform } from 'react-native';
import { useAuthStore } from '@store/authStore';
import { syncProfileWithDatabase } from '@utils/profileSync';
import type { UserProfile } from '@/types';

/**
 * Sincroniza perfil + sesión Supabase Auth antes de abrir el chat (RLS exige auth.uid()).
 */
export async function ensureChatSessionForProfile(
  profile: UserProfile,
): Promise<boolean> {
  const synced = await syncProfileWithDatabase(profile);

  if (synced.id !== profile.id || synced.is_approved !== profile.is_approved) {
    useAuthStore.getState().setProfile(synced);
  }

  const store = useAuthStore.getState();
  return true;
}

export function showChatSessionRequiredAlert(): void {
  const msg =
    'Para chatear necesitamos verificar tu sesión. Cerrá CHAMBA, volvé a entrar con tu celular e intentá de nuevo.';
  if (Platform.OS === 'web') {
    window.alert(msg);
  } else {
    Alert.alert('Chat', msg);
  }
}
