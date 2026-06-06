import type { Session } from '@supabase/supabase-js';
import { supabase } from '@services/supabase';
import { pilotPhoneEmail } from '@constants/pilot';
import { readPublicEnv } from '@utils/env';
import { normalizePhone } from '@utils/profileSync';
import type { UserProfile } from '@/types';

/** Contraseña compartida para cuentas teléfono en piloto / QA (no OTP). */
export const getPhoneAuthPassword = (): string =>
  readPublicEnv('EXPO_PUBLIC_PILOT_PHONE_PASSWORD').trim() || 'ChambaTest123!';

export const resolvePhoneAuthEmail = (profile: UserProfile): string => {
  const email = profile.email?.trim();
  if (email && email.includes('@')) return email;
  return pilotPhoneEmail(normalizePhone(profile.phone));
};

let inflightSession: { profileId: string; promise: Promise<Session | null> } | null = null;

const ensurePhoneAuthSessionInner = async (
  profile: UserProfile,
): Promise<Session | null> => {
  const email = resolvePhoneAuthEmail(profile);
  const password = getPhoneAuthPassword();

  try {
    const { data: existing } = await supabase.auth.getSession();
    const session = existing.session;
    if (session?.user?.id === profile.id) {
      return session;
    }
    if (session && session.user?.id !== profile.id) {
      await supabase.auth.signOut();
    }
  } catch {
    // continuar con sign-in
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.warn('[ensurePhoneAuthSession] signIn:', error.message, { email });
    return null;
  }

  if (!data.session) return null;

  if (data.user.id !== profile.id) {
    console.warn(
      '[ensurePhoneAuthSession] ID distinto: auth=',
      data.user.id,
      'perfil=',
      profile.id,
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

  const promise = ensurePhoneAuthSessionInner(profile);
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
