import { supabase } from '@services/supabase';
import { withTimeout } from '@utils/withTimeout';
import { ENV } from '@utils/env';
import type { UserProfile, UserRole } from '@/types';

const IS_DEMO = ENV.DATA_MODE === 'demo';

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

const PROFILE_PHONE_CACHE_MS = 300_000;
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
    if (!error) {
      const fromRpc = parseProfileRpcRow(data);
      if (fromRpc) return cacheFound(fromRpc);
      if (data === null || data === undefined) return cacheNotFound();
    }
    // RPC con error (p. ej. "statement timeout"): NO abortar el login.
    // Continuar al SELECT directo de respaldo, que es más liviano y sí responde.
  } catch {
    // RPC excedió el withTimeout: continuar al SELECT directo de respaldo.
  }

  const trySelect = async (phoneValue: string): Promise<UserProfile | null> => {
    try {
      // limit(1) en lugar de maybeSingle(): tolera teléfonos duplicados en la DB
      // (maybeSingle lanza error si hay >1 fila y el login fallaría injustamente).
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('phone', phoneValue).limit(1),
        timeoutMs,
      );
      if (error) {
        if (isDbUnavailableMessage(error.message)) {
          throw new Error(error.message);
        }
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return row ? (row as UserProfile) : null;
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

export const fetchProfileByPhone = async (
  phone: string,
): Promise<UserProfile | null> => {
  const lookup = await lookupProfileByPhone(phone);
  if (lookup.status === 'found') return lookup.profile;
  return null;
};

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

export const syncProfileWithDatabase = async (
  profile: UserProfile,
): Promise<UserProfile> => {
  // Demo Mode es 100% offline por diseño — demoDb ya es la fuente de verdad
  // completa para el perfil local, no hay una BD remota con la que sincronizar.
  if (IS_DEMO) return profile;

  const phone = normalizePhone(profile.phone);
  if (!phone) return profile;

  try {
    const byPhone = await fetchProfileByPhone(phone);
    if (byPhone) {
      return mergeProfileFromDatabase(profile, byPhone);
    }
  } catch {
    // Sin red: conservar perfil local
  }

  return profile;
};

export const resolveWorkerProfileForActions = async (
  profile: UserProfile,
): Promise<UserProfile> => syncProfileWithDatabase(profile);

export const ensureProfileInDb = async (profile: UserProfile): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  const canonicalId = session?.user?.id ?? profile.id;

  const effective: UserProfile = { ...profile, id: canonicalId };
  const phone = normalizePhone(effective.phone);
  const dbRole = toDbRole(effective.role);

  const payload: Record<string, unknown> = {
    id:          canonicalId,
    full_name:   effective.full_name.trim(),
    phone:       phone || null,
    email:       effective.email ?? '',
    role:        dbRole,
    is_approved: effective.role === 'admin' ? true : !!effective.is_approved,
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

export const findExactProfileMatch = (
  matches: UserProfile[],
  fullName: string,
  phone: string,
): UserProfile | undefined =>
  matches.find(
    (r) => namesMatch(r.full_name ?? '', fullName) && phonesMatch(r.phone, phone),
  );

export const findProfileByPhone = (
  matches: UserProfile[],
  phone: string,
): UserProfile | undefined => {
  const byPhone = matches.filter((r) => phonesMatch(r.phone, phone));
  return byPhone.length === 1 ? byPhone[0] : undefined;
};

/**
 * Resuelve el perfil del admin para acciones (publicar jobs, etc.).
 * Busca por teléfono o sesión activa.
 */
export const resolveAdminActorProfile = async (
  profile: UserProfile,
): Promise<UserProfile> => {
  const phone = normalizePhone(profile.phone);
  if (phone) {
    const byPhone = await fetchProfileByPhone(phone);
    if (byPhone?.role === 'admin') {
      return { ...byPhone, role: 'admin', is_approved: true };
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) {
    const { data: row } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (row) {
      return { ...(row as UserProfile), role: 'admin', is_approved: true };
    }
    return { ...profile, id: session.user.id, role: 'admin', is_approved: true };
  }

  return { ...profile, role: 'admin', is_approved: true };
};