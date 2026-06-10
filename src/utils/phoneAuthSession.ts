import type { Session } from '@supabase/supabase-js';
import { supabase } from '@services/supabase';
import { pilotPhoneEmail } from '@constants/pilot';
import { readPublicEnv } from '@utils/env';
import { fetchProfileByPhone, normalizePhone } from '@utils/profileSync';
import { withTimeout } from '@utils/withTimeout';
import type { UserProfile } from '@/types';

const PHONE_AUTH_SESSION_MS = 8_000;

/** Contraseña compartida para cuentas teléfono en piloto / QA (no OTP). */
export const getPhoneAuthPassword = (): string =>
  readPublicEnv('EXPO_PUBLIC_PILOT_PHONE_PASSWORD').trim() || 'ChambaTest123!';

export const resolvePhoneAuthEmail = (profile: UserProfile): string => {
  const email = profile.email?.trim();
  if (email && email.includes('@')) return email;
  return pilotPhoneEmail(normalizePhone(profile.phone));
};

let inflightSession: { profileId: string; promise: Promise<Session | null> } | null = null;

/** Usa el ID de profiles en Supabase (por teléfono) para alinear Auth y RPC de chat. */
const resolveCanonicalProfile = async (profile: UserProfile): Promise<UserProfile> => {
  const phone = normalizePhone(profile.phone);
  if (!phone) return profile;
  try {
    const byPhone = await fetchProfileByPhone(phone);
    if (byPhone?.id) {
      return {
        ...profile,
        id: byPhone.id,
        full_name: profile.full_name || byPhone.full_name,
        role: byPhone.role === 'admin' ? byPhone.role : profile.role,
        is_approved: !!byPhone.is_approved,
      };
    }
  } catch {
    // conservar perfil local
  }
  return profile;
};

const ensurePhoneAuthSessionInner = async (
  profile: UserProfile,
): Promise<Session | null> => {
  const effective = await resolveCanonicalProfile(profile);
  const email = resolvePhoneAuthEmail(effective);
  const password = getPhoneAuthPassword();

  try {
    const { data: existing } = await supabase.auth.getSession();
    const session = existing.session;
    if (session?.user?.id === effective.id) {
      return session;
    }
    if (session && session.user?.id !== effective.id) {
      await supabase.auth.signOut();
    }
  } catch {
    // continuar con sign-in
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const invalidCreds =
      error.message?.toLowerCase().includes('invalid login')
      || error.message?.toLowerCase().includes('invalid credentials');

    if (invalidCreds && effective.phone) {
      const { data: provision, error: provErr } = await supabase.rpc('ensure_phone_auth_user', {
        p_profile_id: effective.id,
        p_phone: normalizePhone(effective.phone),
      });

      const body = provision as { success?: boolean; error?: string } | null;
      if (provErr) {
        console.warn('[ensurePhoneAuthSession] provision RPC:', provErr.message);
      } else if (body?.success) {
        const retry = await supabase.auth.signInWithPassword({ email, password });
        if (!retry.error && retry.data.session) {
          if (retry.data.user.id !== effective.id) {
            console.warn('[ensurePhoneAuthSession] ID distinto tras provision');
            await supabase.auth.signOut();
            return null;
          }
          return retry.data.session;
        }
        console.warn('[ensurePhoneAuthSession] signIn tras provision:', retry.error?.message);
      } else {
        console.warn('[ensurePhoneAuthSession] provision falló:', body?.error);
      }
    }

    const schemaErr = error.message?.toLowerCase().includes('database error querying schema');
    if (schemaErr) {
      console.warn(
        '[ensurePhoneAuthSession] auth.users con tokens NULL — contactá soporte o ejecutá db:ensure-phone-auth-user',
      );
    }

    console.warn('[ensurePhoneAuthSession] signIn:', error.message, { email });
    return null;
  }

  if (!data.session) return null;

  if (data.user.id !== effective.id) {
    console.warn(
      '[ensurePhoneAuthSession] ID distinto: auth=',
      data.user.id,
      'perfil=',
      effective.id,
      '— ejecutá npm run db:reset-two-users',
    );
    await supabase.auth.signOut();
    return null;
  }

  return data.session;
};

/**
 * Abre sesión Supabase Auth para que auth.uid() coincida con RLS (feed técnico, jobs cliente).
 * Requiere usuario Auth creado con el mismo id que profiles (npm run db:reset-two-users).
 */
export const ensurePhoneAuthSession = async (
  profile: UserProfile,
): Promise<Session | null> => {
  if (inflightSession?.profileId === profile.id) {
    return inflightSession.promise;
  }

  const promise = withTimeout(
    ensurePhoneAuthSessionInner(profile),
    PHONE_AUTH_SESSION_MS,
  ).catch((err: unknown) => {
    console.warn('[ensurePhoneAuthSession] timeout o error:', err);
    return null;
  });
  inflightSession = { profileId: profile.id, promise };
  try {
    return await promise;
  } finally {
    if (inflightSession?.promise === promise) inflightSession = null;
  }
};

/** Cierra sesión Auth si no coincide con el perfil (evita feed vacío por RLS). */
export const clearMismatchedAuthSession = async (
  profile: { id: string },
): Promise<void> => {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid && uid !== profile.id) {
      await supabase.auth.signOut();
    }
  } catch {
    // ignorar
  }
};
