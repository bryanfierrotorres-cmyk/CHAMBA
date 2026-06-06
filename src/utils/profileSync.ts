import { supabase } from '@services/supabase';
import { CONFIG } from '@constants/config';
import { pilotPhoneEmail } from '@constants/pilot';
import { applyPilotProfile } from '@utils/pilotAccess';
import { useAuthStore } from '@store/authStore';
import { migrateLocalAssignmentsWorkerId } from '@utils/localAssignments';
import {
  PILOT_STORAGE_KEY,
  safePersistPilotProfile,
} from '@utils/pilotProfileStorage';
import type { UserProfile, UserRole } from '@/types';

// Re-export for compat
export { PILOT_STORAGE_KEY };

type SyncableProfile = Pick<
  UserProfile,
  'id' | 'full_name' | 'phone' | 'email' | 'role' | 'is_approved'
>;

/** Normaliza teléfono a 8 dígitos. */
export const normalizePhone = (phone: string | null | undefined): string =>
  (phone ?? '').replace(/\D/g, '');

/** Compara teléfonos ignorando guiones y prefijos. */
export const phonesMatch = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean => {
  const da = normalizePhone(a);
  const db = normalizePhone(b);
  return da.length > 0 && da === db;
};

/** Rol persistido en Postgres (enum user_role incluye client). */
export const toDbRole = (role: UserRole): UserRole =>
  role === 'client' ? 'client' : role;

/** Comparación de nombre insensible a mayúsculas. */
export const namesMatch = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const PROFILE_PHONE_CACHE_MS = 45_000;
const profileByPhoneCache = new Map<
  string,
  { at: number; profile: UserProfile | null }
>();

export const invalidateProfilePhoneCache = (phone?: string): void => {
  if (phone) profileByPhoneCache.delete(normalizePhone(phone));
  else profileByPhoneCache.clear();
};

/** Busca perfil en BD por teléfono (RPC SECURITY DEFINER o SELECT directo). */
export const fetchProfileByPhone = async (
  phone: string,
): Promise<UserProfile | null> => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const cached = profileByPhoneCache.get(normalized);
  if (cached && Date.now() - cached.at < PROFILE_PHONE_CACHE_MS) {
    return cached.profile;
  }

  try {
    const { data, error } = await supabase.rpc('get_profile_by_phone', {
      p_phone: normalized,
    });
    if (!error && data) {
      const row = typeof data === 'string' ? JSON.parse(data) : data;
      if (row?.id) {
        const profile = row as UserProfile;
        profileByPhoneCache.set(normalized, { at: Date.now(), profile });
        return profile;
      }
    }
  } catch {
    // RPC puede no existir aún en Supabase remoto
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalized)
      .maybeSingle();
    if (!error && data) {
      const profile = data as UserProfile;
      profileByPhoneCache.set(normalized, { at: Date.now(), profile });
      return profile;
    }
  } catch {
    // RLS puede bloquear SELECT anónimo
  }

  if (normalized.length === 8) {
    const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', formatted)
        .maybeSingle();
      if (!error && data) {
        const profile = data as UserProfile;
        profileByPhoneCache.set(normalized, { at: Date.now(), profile });
        return profile;
      }
    } catch {
      // ignorar
    }
  }

  profileByPhoneCache.set(normalized, { at: Date.now(), profile: null });
  return null;
};

/**
 * Si el teléfono ya existe en Supabase, usa ese perfil (ID canónico).
 * Evita que "Luis Papa" quede con UUID local distinto a "luis papa" en BD.
 */
export const syncProfileWithDatabase = async (
  profile: UserProfile,
): Promise<UserProfile> => {
  const phone = normalizePhone(profile.phone);
  if (!phone) {
    return profile.role === 'worker' ? applyPilotProfile(profile) : profile;
  }

  try {
    const byPhone = await fetchProfileByPhone(phone);
    if (byPhone) {
      const merged: UserProfile = {
        ...byPhone,
        role: byPhone.role === 'admin' ? byPhone.role : profile.role,
        full_name: profile.full_name || byPhone.full_name,
        is_approved: !!byPhone.is_approved,
      };
      return merged.role === 'worker' ? applyPilotProfile(merged) : merged;
    }
  } catch {
    // Sin red: conservar perfil local
  }

  return profile.role === 'worker' ? applyPilotProfile(profile) : profile;
};

/** Alinea el perfil local con el ID canónico de Supabase antes de aceptar chambas. */
export const resolveWorkerProfileForActions = async (
  profile: UserProfile,
): Promise<UserProfile> => syncProfileWithDatabase(profile);

/** Persiste perfil corregido en store + AsyncStorage (login por teléfono). */
export const persistPilotProfileIfChanged = async (
  before: UserProfile,
  after: UserProfile,
): Promise<void> => {
  if (before.id === after.id) return;
  await migrateLocalAssignmentsWorkerId(before.id, after.id);
  await safePersistPilotProfile(after);
  useAuthStore.getState().setProfile(after);
  useAuthStore.getState().setPhoneAuth(true);
};

/**
 * Alinea el perfil con auth.uid() en Supabase (RLS usa is_approved de la BD).
 * En piloto, marca al técnico como aprobado y categorías habilitadas.
 */
export const ensureProfileInDb = async (profile: UserProfile): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  const canonicalId = session?.user?.id ?? profile.id;

  let effective: UserProfile = { ...profile, id: canonicalId };
  if (effective.role === 'worker' && CONFIG.pilot.enabled) {
    effective = applyPilotProfile(effective);
  }
  const phone = normalizePhone(effective.phone);
  const dbRole = toDbRole(effective.role);

  const payload: Record<string, unknown> = {
    id:          canonicalId,
    full_name:   effective.full_name.trim(),
    phone:       phone || null,
    email:       effective.email ?? pilotPhoneEmail(phone || canonicalId.replace(/-/g, '')),
    role:        dbRole,
    is_approved:
      effective.role === 'admin' ? true : !!effective.is_approved,
  };

  if (effective.role === 'worker') {
    payload.category_1_approved = effective.category_1_approved ?? false;
    payload.category_2_approved = effective.category_2_approved ?? false;
  }

  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (upsertErr) {
    console.warn('[ensureProfileInDb]', upsertErr.message);
  }
};

/** @deprecated Usar ensureProfileInDb */
export const ensureWorkerProfileInDb = ensureProfileInDb;

/** Busca coincidencia exacta nombre+teléfono (case-insensitive). */
export const findExactProfileMatch = (
  matches: UserProfile[],
  fullName: string,
  phone: string,
): UserProfile | undefined =>
  matches.find(
    (r) => namesMatch(r.full_name ?? '', fullName) && phonesMatch(r.phone, phone),
  );

/** Si solo hay un perfil con ese teléfono, reutilizarlo (piloto). */
export const findProfileByPhone = (
  matches: UserProfile[],
  phone: string,
): UserProfile | undefined => {
  const byPhone = matches.filter((r) => phonesMatch(r.phone, phone));
  return byPhone.length === 1 ? byPhone[0] : undefined;
};
