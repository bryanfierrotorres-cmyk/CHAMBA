import { CONFIG } from '@constants/config';
import { PILOT_DOCUMENT_BYPASS } from '@constants/pilot';
import type { UserProfile } from '@/types';

/** True while EXPO_PUBLIC_PILOT_MODE is enabled (default in pruebas). */
export const isPilotFreeAccess = (): boolean => CONFIG.pilot.enabled;

/**
 * Normalizes any profile for unrestricted pilot/testing access:
 * approved, active, all categories enabled, docs bypassed.
 */
export const applyPilotProfile = (profile: UserProfile): UserProfile => {
  if (!CONFIG.pilot.enabled) return profile;

  if (profile.role === 'client') {
    return { ...profile, is_approved: true };
  }

  return {
    ...profile,
    is_approved:           true,
    worker_status:         profile.worker_status === 'suspended' ? 'active' : (profile.worker_status ?? 'active'),
    cedula_url:            profile.cedula_url            ?? PILOT_DOCUMENT_BYPASS,
    record_policia_url:    profile.record_policia_url    ?? PILOT_DOCUMENT_BYPASS,
    category_1_approved:   true,
    category_2_approved:   true,
  };
};
