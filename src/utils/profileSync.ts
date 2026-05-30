import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@services/supabase';
import { CONFIG } from '@constants/config';
import { applyPilotProfile } from '@utils/pilotAccess';
import { useAuthStore } from '@store/authStore';
import { migrateLocalAssignmentsWorkerId } from '@utils/localAssignments';
import type { UserProfile, UserRole } from '@/types';

export const PILOT_STORAGE_KEY = 'CHAMBA_PILOT_PROFILE';

type SyncableProfile = Pick<
  UserProfile,
  'id' | 'full_name' | 'phone' | 'email' | 'role' | 'is_approved'
>;

/** Normaliza teléfono a 8 dígitos. */
export const normalizePhone = (phone: string | null | undefined): string =>
  (phone ?? '').replace(/\D/g, '');

/** Comparación de nombre insensible a mayúsculas. */
export const namesMatch = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Busca perfil en BD por teléfono (RPC SECURITY DEFINER o SELECT directo). */
export const fetchProfileByPhone = async (
  phone: string,
): Promise<UserProfile | null> => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  try {
    const { data, error } = await supabase.rpc('get_profile_by_phone', {
      p_phone: normalized,
    });
    if (!error && data) {
      const row = typeof data === 'string' ? JSON.parse(data) : data;
      if (row?.id) return row as UserProfile;
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
    if (!error && data) return data as UserProfile;
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
      if (!error && data) return data as UserProfile;
    } catch {
      // ignorar
    }
  }

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
  if (!phone) return applyPilotProfile(profile);

  const byPhone = await fetchProfileByPhone(phone);
  if (byPhone) {
    return applyPilotProfile({
      ...byPhone,
      role: profile.role,
      full_name: profile.full_name || byPhone.full_name,
    });
  }

  return applyPilotProfile(profile);
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
  await AsyncStorage.setItem(PILOT_STORAGE_KEY, JSON.stringify(after));
  useAuthStore.getState().setProfile(after);
  useAuthStore.getState().setPhoneAuth(true);
};

/** Garantiza que el perfil exista en Supabase (piloto / teléfono). */
export const ensureProfileInDb = async (
  profile: SyncableProfile,
): Promise<void> => {
  if (!CONFIG.pilot.enabled) return;

  const phone = normalizePhone(profile.phone);

  if (phone) {
    const canonical = await fetchProfileByPhone(phone);
    if (canonical?.id) return;
  }

  const dbRole = profile.role === 'client' ? 'worker' : profile.role;
  const payload = {
    id:          profile.id,
    full_name:   profile.full_name.trim(),
    phone:       phone || null,
    email:       profile.email ?? `${phone || profile.id}@chamba-pilot.app`,
    role:        dbRole,
    is_approved: profile.role === 'admin' ? true : (profile.is_approved ?? true),
  };

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
    (r) => namesMatch(r.full_name ?? '', fullName) && r.phone === phone,
  );

/** Si solo hay un perfil con ese teléfono, reutilizarlo (piloto). */
export const findProfileByPhone = (
  matches: UserProfile[],
  phone: string,
): UserProfile | undefined => {
  const byPhone = matches.filter((r) => r.phone === phone);
  return byPhone.length === 1 ? byPhone[0] : undefined;
};
