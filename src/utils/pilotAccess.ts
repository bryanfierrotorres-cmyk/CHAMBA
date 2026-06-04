import { CONFIG } from '@constants/config';
import { PILOT_DOCUMENT_BYPASS } from '@constants/pilot';
import type { UserProfile } from '@/types';

/** True while EXPO_PUBLIC_PILOT_MODE is enabled (default in pruebas). */
export const isPilotFreeAccess = (): boolean => CONFIG.pilot.enabled;

/**
 * Piloto: bypass de documentos y categorías solo para perfiles ya aprobados en BD.
 * No cambia is_approved — eso lo define el administrador.
 */
export const applyPilotProfile = (profile: UserProfile): UserProfile => {
  if (!CONFIG.pilot.enabled || !profile.is_approved) return profile;

  if (profile.role === 'client') {
    return profile;
  }

  if (profile.role !== 'worker') {
    return profile;
  }

  return {
    ...profile,
    worker_status:         profile.worker_status === 'suspended' ? 'active' : (profile.worker_status ?? 'active'),
    cedula_url:            profile.cedula_url            ?? PILOT_DOCUMENT_BYPASS,
    record_policia_url:    profile.record_policia_url    ?? PILOT_DOCUMENT_BYPASS,
    category_1_approved:   profile.category_1 ? true : profile.category_1_approved,
    category_2_approved:   profile.category_2 ? (profile.category_2_approved || true) : false,
  };
};
