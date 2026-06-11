import { supabase } from '@services/supabase';
import { CONFIG } from '@constants/config';
import { pilotPhoneEmail, getPilotProfileId } from '@constants/pilot';
import { withTimeout } from '@utils/withTimeout';

export { pilotPhoneEmail };
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
const PROFILE_PHONE_FETCH_MS = 8_000;
const profileByPhoneCache = new Map<
  string,
  { at: number; profile: UserProfile | null }
>();

export type ProfilePhoneLookup =
  | { status: 'found'; profile: UserProfile }
  | { status: 'not_found' }
  | { status: 'unavailable'; reason: string };

const isDbUnavailableMessage = (msg: string): boolean =>
  /schema cache|could not query the database|database not available|connection|timeout|econnrefused|network|503|502|504|pgrst/i.test(
    msg,
  );

const parseProfileRpcRow = (data: unknown): UserProfile | null => {
  if (!data) return null;
  const row = typeof data === 'string' ? JSON.parse(data) : data;
  return row?.id ? (row as UserProfile) : null;
};

export const invalidateProfilePhoneCache = (phone?: string): void => {
  if (phone) profileByPhoneCache.delete(normalizePhone(phone));
  else profileByPhoneCache.clear();
};

/** Busca perfil por teléfono; distingue «no existe» de «servidor caído». */
export const lookupProfileByPhone = async (
  phone: string,
  timeoutMs = PROFILE_PHONE_FETCH_MS,
): Promise<ProfilePhoneLookup> => {
  const normalized = normalizePhone(phone);
  if (!normalized) return { status: 'not_found' };

  const cached = profileByPhoneCache.get(normalized);
  if (cached && Date.now() - cached.at < PROFILE_PHONE_CACHE_MS) {
    return cached.profile
      ? { status: 'found', profile: cached.profile }
      : { status: 'not_found' };
  }

  const cacheFound = (profile: UserProfile): ProfilePhoneLookup => {
    profileByPhoneCache.set(normalized, { at: Date.now(), profile });
    return { status: 'found', profile };
  };

  const cacheNotFound = (): ProfilePhoneLookup => {
    profileByPhoneCache.set(normalized, { at: Date.now(), profile: null });
    return { status: 'not_found' };
  };

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('get_profile_by_phone', { p_phone: normalized }),
      timeoutMs,
    );
    if (error) {
      if (isDbUnavailableMessage(error.message)) {
        return { status: 'unavailable', reason: error.message };
      }
    } else {
      const fromRpc = parseProfileRpcRow(data);
      if (fromRpc) return cacheFound(fromRpc);
      if (data === null || data === undefined) return cacheNotFound();
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'timeout';
    return { status: 'unavailable', reason };
  }

  const trySelect = async (phoneValue: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('phone', phoneValue).maybeSingle(),
        timeoutMs,
      );
      if (error) {
        if (isDbUnavailableMessage(error.message)) {
          throw new Error(error.message);
        }
        return null;
      }
      return data ? (data as UserProfile) : null;
    } catch (err) {
      if (err instanceof Error && isDbUnavailableMessage(err.message)) {
        throw err;
      }
      return null;
    }
  };

  try {
    const direct = await trySelect(normalized);
    if (direct) return cacheFound(direct);

    if (normalized.length === 8) {
      const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
      const alt = await trySelect(formatted);
      if (alt) return cacheFound(alt);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'timeout';
    return { status: 'unavailable', reason };
  }

  return cacheNotFound();
};

/** Busca perfil en BD por teléfono (RPC SECURITY DEFINER o SELECT directo). */
export const fetchProfileByPhone = async (
  phone: string,
): Promise<UserProfile | null> => {
  const lookup = await lookupProfileByPhone(phone);
  if (lookup.status === 'found') return lookup.profile;
  return null;
};

/** Login: lookup con timeout; no cachea fallos de servidor como «no registrado». */
export const fetchProfileByPhoneQuick = async (
  phone: string,
  timeoutMs = 8_000,
): Promise<UserProfile | null> => {
  const lookup = await lookupProfileByPhone(phone, timeoutMs);
  if (lookup.status === 'found') return lookup.profile;
  if (lookup.status === 'unavailable') {
    throw new Error(
      'El servidor no responde. Tus datos siguen guardados — esperá un momento e intentá de nuevo.',
    );
  }
  return null;
};

/**
 * Combina fila remota con perfil local sin perder onboarding ya enviado
 * (documentos/categorías cuando el UPDATE a BD falló por RLS o sesión).
 */
export const mergeProfileFromDatabase = (
  local: UserProfile,
  remote: UserProfile,
): UserProfile => {
  const localOnboardingSent =
    local.worker_status === 'pending_approval'
    || (!!local.cedula_url && !!local.record_policia_url && !!local.category_1);

  const merged: UserProfile = {
    ...remote,
    role: remote.role === 'admin' ? remote.role : local.role,
    full_name: local.full_name || remote.full_name,
    is_approved: !!remote.is_approved,
    cedula_url: remote.cedula_url ?? local.cedula_url,
    record_policia_url: remote.record_policia_url ?? local.record_policia_url,
    category_1: remote.category_1 ?? local.category_1,
    category_2: remote.category_2 ?? local.category_2,
    category_1_approved: remote.category_1_approved ?? local.category_1_approved,
    category_2_approved: remote.category_2_approved ?? local.category_2_approved,
    worker_status:
      localOnboardingSent && remote.worker_status === 'incomplete'
        ? (local.worker_status ?? 'pending_approval')
        : (remote.worker_status ?? local.worker_status),
  };

  return merged;
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
      const merged = mergeProfileFromDatabase(profile, byPhone);
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

/**
 * ID canónico del admin en Supabase (auth.uid o perfil por teléfono).
 * Necesario en piloto: el store local puede tener un UUID distinto al de la BD.
 */
export const resolveAdminActorProfile = async (
  profile: UserProfile,
): Promise<UserProfile> => {
  const phoneCandidates = [
    normalizePhone(profile.phone),
    normalizePhone(CONFIG.pilot.admin.phone),
  ].filter((p, i, arr) => p.length > 0 && arr.indexOf(p) === i);

  for (const phone of phoneCandidates) {
    const byPhone = await fetchProfileByPhone(phone);
    if (byPhone?.role === 'admin') {
      const resolved: UserProfile = {
        ...byPhone,
        role: 'admin',
        is_approved: true,
      };
      await persistPilotProfileIfChanged(profile, resolved);
      return resolved;
    }
  }

  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id && CONFIG.pilot.enabled) {
    const creds = CONFIG.pilot.admin;
    if (creds.email && creds.password) {
      try {
        const { data } = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        });
        session = data.session;
      } catch {
        // Sin red o credenciales inválidas
      }
    }
  }

  const canonicalId = session?.user?.id ?? getPilotProfileId('admin') ?? profile.id;
  const effective: UserProfile = {
    ...profile,
    id: canonicalId,
    role: 'admin',
    is_approved: true,
    phone: profile.phone || CONFIG.pilot.admin.phone,
    email: profile.email || CONFIG.pilot.admin.email,
    full_name: profile.full_name || CONFIG.pilot.admin.fullName,
  };

  await ensureProfileInDb(effective);
  invalidateProfilePhoneCache();

  for (const phone of phoneCandidates) {
    const byPhone = await fetchProfileByPhone(phone);
    if (byPhone?.role === 'admin') {
      const resolved: UserProfile = {
        ...byPhone,
        role: 'admin',
        is_approved: true,
      };
      await persistPilotProfileIfChanged(profile, resolved);
      return resolved;
    }
  }

  if (session?.user?.id) {
    const { data: row } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (row) {
      const resolved: UserProfile = {
        ...(row as UserProfile),
        role: 'admin',
        is_approved: true,
      };
      await persistPilotProfileIfChanged(profile, resolved);
      return resolved;
    }
    const fallback: UserProfile = { ...effective, id: session.user.id };
    await persistPilotProfileIfChanged(profile, fallback);
    return fallback;
  }

  await persistPilotProfileIfChanged(profile, effective);
  return effective;
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
