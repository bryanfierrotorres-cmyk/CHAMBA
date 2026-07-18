import type { UserProfile } from '@/types';
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
} from '@features/auth/services/authService';
import type { ProfileRepository, ProfileUpdatePatch } from './ProfileRepository';

/**
 * Envuelve las funciones YA EXISTENTES de authService, sin modificarlas.
 * Delegación pura — mismo comportamiento, mismo SQL, mismo bucket de Storage.
 * (Condición del usuario: no eliminar ni reescribir authService hasta validar el patrón.)
 */
export class SupabaseProfileRepository implements ProfileRepository {
  getById(userId: string): Promise<UserProfile> {
    return fetchProfile(userId);
  }

  update(userId: string, patch: ProfileUpdatePatch): Promise<UserProfile> {
    return updateProfile(userId, patch);
  }

  uploadAvatar(userId: string, localUri: string): Promise<string> {
    return uploadAvatar(userId, localUri);
  }
}
