import type { UserProfile } from '@/types';

/**
 * Campos editables de UserProfile a través del repositorio.
 * Refleja exactamente lo que authService.updateProfile acepta hoy
 * (cedula_url/category_1/2 se escriben por otra ruta — fuera de este piloto).
 */
export type ProfileUpdatePatch = Partial<
  Pick<UserProfile, 'full_name' | 'phone' | 'avatar_url' | 'fcm_token'>
>;

/**
 * Contrato del dominio Perfil, independiente del backend.
 * Implementaciones: SupabaseProfileRepository (real), DemoProfileRepository (sin backend).
 */
export interface ProfileRepository {
  getById(userId: string): Promise<UserProfile | null>;
  update(userId: string, patch: ProfileUpdatePatch): Promise<UserProfile>;
  uploadAvatar(userId: string, localUri: string): Promise<string>;
}
