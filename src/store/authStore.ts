import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@/types';
import { supabase } from '@services/supabase';
import { CONFIG } from '@constants/config';
import {
  PILOT_DOCUMENT_BYPASS,
  getPilotProfileId,
  pilotPhoneEmail,
} from '@constants/pilot';
import { applyPilotProfile } from '@utils/pilotAccess';
import {
  normalizePhone,
  syncProfileWithDatabase,
  findExactProfileMatch,
  findProfileByPhone,
  fetchProfileByPhone,
  ensureProfileInDb,
  toDbRole,
  phonesMatch,
} from '@utils/profileSync';
import { useAssignmentsStore } from '@store/assignmentsStore';
import { withTimeout } from '@utils/withTimeout';
import { ensurePhoneAuthSession } from '@utils/phoneAuthSession';
import {
  PILOT_STORAGE_KEY,
  safePersistPilotProfile,
  safeRemovePilotProfile,
} from '@utils/pilotProfileStorage';

/** Minimal UUID v4 — no external dependency needed. */
const uuid4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// ─── State shape ────────────────────────────────────────────────

interface AuthState {
  // Data
  session:      Session | null;
  profile:      UserProfile | null;
  // Status flags
  isLoading:    boolean;    // operación en curso (login, register…)
  isHydrated:   boolean;    // sesión inicial ya fue revisada
  isPhoneAuth:  boolean;    // true when user signed in with name+phone (no Supabase session)
  error:        string | null;

  // Setters
  setSession:  (session: Session | null)     => void;
  setProfile:  (profile: UserProfile | null) => void;
  setLoading:  (loading: boolean)            => void;
  setHydrated: (hydrated: boolean)           => void;
  setError:    (error: string | null)        => void;
  setPhoneAuth:(value: boolean)              => void;

  // Actions
  fetchProfile:    (userId: string)                                => Promise<void>;
  signIn:          (email: string, password: string)               => Promise<void>;
  signUp:          (params: SignUpParams)                          => Promise<void>;
  pilotSignIn:     (role?: UserRole)                               => Promise<void>;
  /** @deprecated Solo piloto interno; no usar en login público. */
  phoneSignIn:     (fullName: string, phone: string, role: UserRole) => Promise<void>;
  /** Verifica teléfono en BD y envía OTP (sin crear usuario). */
  requestPhoneLoginOtp: (phone: string) => Promise<void>;
  /** Valida código SMS y abre sesión Supabase + perfil. */
  verifyPhoneLoginOtp: (phone: string, token: string, role: UserRole) => Promise<void>;
  /** Crea perfil en BD sin iniciar sesión (registro → luego login OTP). */
  registerPhoneProfile: (fullName: string, phone: string, role: UserRole) => Promise<void>;
  /** Hydrate store from AsyncStorage (phone-auth users). */
  loadFromStorage: ()                                              => Promise<boolean>;
  signOut:         ()                                              => Promise<void>;
  reset:           ()                                              => void;
}

export interface SignUpParams {
  email:     string;
  password:  string;
  fullName:  string;
  phone:     string;
  role:      UserRole;
}

// ─── Store ──────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  session:     null,
  profile:     null,
  isLoading:   true,
  isHydrated:  false,
  isPhoneAuth: false,
  error:       null,

  setSession:   (session)     => set({ session }),
  setProfile:   (profile)     => set({ profile }),
  setLoading:   (isLoading)   => set({ isLoading }),
  setHydrated:  (isHydrated)  => set({ isHydrated }),
  setError:     (error)       => set({ error }),
  setPhoneAuth: (isPhoneAuth) => set({ isPhoneAuth }),

  // ── fetchProfile ──────────────────────────────────────────────
  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      let profile = data as UserProfile;

      // Preserve avatar saved locally if Supabase profile has none yet
      const current = get().profile;
      if (current?.id === userId && current.avatar_url && !profile.avatar_url) {
        profile = { ...profile, avatar_url: current.avatar_url };
      }

      // Piloto: workers entran aprobados y con campos de documentos no nulos
      // para evitar que el guard de onboarding los bloquee
      if (CONFIG.pilot.enabled && profile.role === 'worker') {
        profile = applyPilotProfile({
          ...profile,
          worker_status:     profile.worker_status ?? 'active',
          cedula_url:        profile.cedula_url        ?? PILOT_DOCUMENT_BYPASS,
          record_policia_url: profile.record_policia_url ?? PILOT_DOCUMENT_BYPASS,
        });
      }
      set({ profile });
    } catch (err: any) {
      console.error('[AuthStore] fetchProfile error:', err.message);
      const { profile: current, isPhoneAuth } = get();
      if (isPhoneAuth || current?.id === userId) return;
      set({ profile: null });
    }
  },

  // ── signIn ────────────────────────────────────────────────────
  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      if (data.session) set({ session: data.session });
      if (data.user) await get().fetchProfile(data.user.id);
    } catch (err: any) {
      const msg = translateAuthError(err.message);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── signUp ────────────────────────────────────────────────────
  signUp: async ({ email, password, fullName, phone, role }) => {
    set({ isLoading: true, error: null });
    try {
      const cleanPhone = normalizePhone(phone);
      if (cleanPhone.length !== 8) {
        throw new Error('Celular inválido — ingresa 8 dígitos después de +505');
      }

      // 1. Crear usuario en auth.users
      const trimmedName = fullName.trim();
      const trimmedEmail = email.trim().toLowerCase();

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            role,
            phone: cleanPhone,
          },
        },
      });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      if (authData.session) {
        set({ session: authData.session, isPhoneAuth: false });
      } else {
        set({ isPhoneAuth: false });
      }

      const profilePayload = {
        id:          authData.user.id,
        email:       trimmedEmail,
        full_name:   trimmedName,
        phone:       cleanPhone,
        role,
        is_approved: false,
        ...(role === 'worker' ? { worker_status: 'pending_approval' as const } : {}),
      };

      // El trigger fn_handle_new_user crea el perfil; este upsert completa teléfono y rol.
      const { error: profileErr } = await supabase.from('profiles').upsert(profilePayload);
      if (profileErr) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            full_name:   trimmedName,
            phone:       cleanPhone,
            role,
            is_approved: false,
            ...(role === 'worker' ? { worker_status: 'pending_approval' } : {}),
          })
          .eq('id', authData.user.id);
        if (updateErr) throw profileErr;
      }

      await get().fetchProfile(authData.user.id);
    } catch (err: any) {
      const msg = translateAuthError(err.message);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── pilotSignIn — acceso rápido (admin / worker) con respaldo local ──
  pilotSignIn: async (role = 'worker') => {
    const creds = role === 'admin' ? CONFIG.pilot.admin : CONFIG.pilot.worker;
    const pilotKey = role === 'admin' ? 'admin' : 'worker';
    set({ isLoading: true, error: null });

    const buildLocalPilotProfile = (): UserProfile => {
      const base: UserProfile = {
        id:                 getPilotProfileId(pilotKey) ?? uuid4(),
        email:              creds.email,
        full_name:          creds.fullName,
        phone:              creds.phone,
        avatar_url:         null,
        role,
        is_approved:        true,
        worker_status:      role === 'worker' ? 'active' : null,
        cedula_url:         role === 'worker' ? PILOT_DOCUMENT_BYPASS : null,
        record_policia_url: role === 'worker' ? PILOT_DOCUMENT_BYPASS : null,
        category_1:         null,
        category_2:         null,
        category_1_approved: role === 'worker',
        category_2_approved: false,
        stripe_account_id:  null,
        fcm_token:          null,
        created_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      };
      return role === 'worker' && CONFIG.pilot.enabled
        ? applyPilotProfile(base)
        : { ...base, is_approved: true, role: 'admin' };
    };

    const finishPilotSession = async (
      profile: UserProfile,
      session: Session | null,
    ) => {
      let normalized = profile;
      if (CONFIG.pilot.enabled && profile.role === 'worker') {
        normalized = applyPilotProfile(profile);
      }
      if (profile.role === 'admin') {
        normalized = { ...normalized, role: 'admin', is_approved: true };
      }

      await safePersistPilotProfile(normalized);
      set({
        profile:     normalized,
        session,
        isPhoneAuth: true,
        isLoading:   false,
        error:       null,
      });
    };

    // Admin piloto: entrar al panel al instante (sync Supabase en segundo plano).
    if (role === 'admin' && CONFIG.pilot.enabled) {
      try {
        const profile = buildLocalPilotProfile();
        await finishPilotSession(profile, null);

        void (async () => {
          try {
            const { data } = await withTimeout(
              supabase.auth.signInWithPassword({
                email:    creds.email,
                password: creds.password,
              }),
              6_000,
            );
            if (data.session) set({ session: data.session });
            const byPhone = await fetchProfileByPhone(creds.phone);
            if (byPhone) {
              const merged: UserProfile = {
                ...byPhone,
                role: 'admin',
                full_name: creds.fullName,
                phone: creds.phone,
                is_approved: true,
              };
              await safePersistPilotProfile(merged);
              set({ profile: merged, session: data.session ?? null });
            }
          } catch (syncErr) {
            console.warn('[pilotSignIn] sync admin en segundo plano:', syncErr);
          }
        })();
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'No se pudo iniciar sesión de administrador';
        set({ error: msg, isLoading: false });
        throw new Error(msg);
      }
    }

    // 1) Intentar Supabase Auth (opcional en piloto)
    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email:    creds.email,
        password: creds.password,
      });

      if (error?.message.includes('Invalid login credentials')) {
        try {
          await get().signUp({
            email:    creds.email,
            password: creds.password,
            fullName: creds.fullName,
            phone:    creds.phone,
            role,
          });
          ({ data, error } = await supabase.auth.signInWithPassword({
            email:    creds.email,
            password: creds.password,
          }));
        } catch (signUpErr: unknown) {
          console.warn('[pilotSignIn] signUp falló, usando perfil local:', signUpErr);
        }
      }

      if (!error && data.user) {
        if (data.session) set({ session: data.session });
        await get().fetchProfile(data.user.id);
        let profile = get().profile;

        if (profile) {
          profile = {
            ...profile,
            role,
            full_name: creds.fullName,
            phone:     creds.phone,
            is_approved: role === 'admin' ? true : !!profile.is_approved,
          };
          profile = await syncProfileWithDatabase(profile);
          if (profile.role === 'worker') {
            profile = applyPilotProfile(profile);
          }
          await finishPilotSession(profile, data.session);
          return;
        }
      }
    } catch (authErr: unknown) {
      console.warn('[pilotSignIn] Auth Supabase no disponible, respaldo local:', authErr);
    }

    // 2) Respaldo: perfil piloto local (sin JWT) — crítico para admin en web
    try {
      let profile = buildLocalPilotProfile();

      const byPhone = await fetchProfileByPhone(creds.phone);
      if (byPhone) {
        profile = {
          ...byPhone,
          id:          byPhone.id ?? profile.id,
          role,
          full_name:   creds.fullName,
          phone:       creds.phone,
          is_approved: role === 'admin' ? true : !!byPhone.is_approved,
        };
        if (profile.role === 'worker') {
          profile = applyPilotProfile(profile);
        }
      } else if (role === 'admin') {
        await ensureProfileInDb({
          id:          profile.id,
          full_name:   profile.full_name,
          phone:       profile.phone,
          email:       profile.email,
          role:        profile.role,
          is_approved: true,
        });
      }

      await finishPilotSession(profile, null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar sesión piloto';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // ── requestPhoneLoginOtp — usuario debe existir en profiles ─────
  requestPhoneLoginOtp: async (phone) => {
    set({ isLoading: true, error: null });
    try {
      const cleanPhone = normalizePhone(phone);
      if (cleanPhone.length !== 8) {
        throw new Error('Ingresá exactamente 8 dígitos de tu celular');
      }

      const existing = await fetchProfileByPhone(cleanPhone);
      if (!existing) {
        const msg = 'Número no registrado, por favor regístrate primero';
        set({ error: msg, isLoading: false });
        throw new Error(msg);
      }

      const phoneE164 = `+505${cleanPhone}`;
      // Perfil ya validado en DB; crear usuario Auth si aún no existe (registro previo).
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneE164,
        options: { shouldCreateUser: true },
      });

      if (error) {
        const msg = translateAuthError(error.message);
        set({ error: msg, isLoading: false });
        throw new Error(msg);
      }

      set({ isLoading: false, error: null });
    } catch (err: unknown) {
      if (!(err instanceof Error) || !get().error) {
        const msg = err instanceof Error ? err.message : 'No se pudo enviar el código';
        set({ error: msg, isLoading: false });
      }
      throw err instanceof Error ? err : new Error('No se pudo enviar el código');
    }
  },

  // ── verifyPhoneLoginOtp — sesión obligatoria para entrar a la app ──
  verifyPhoneLoginOtp: async (phone, token, role) => {
    set({ isLoading: true, error: null });
    try {
      const cleanPhone = normalizePhone(phone);
      const code = token.replace(/\D/g, '');
      if (code.length < 4) {
        throw new Error('Ingresá el código que recibiste por SMS');
      }

      const phoneE164 = `+505${cleanPhone}`;
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token: code,
        type: 'sms',
      });

      if (error) {
        const msg = translateAuthError(error.message);
        set({ error: msg, isLoading: false });
        throw new Error(msg);
      }
      if (!data.session) {
        throw new Error('Código inválido o expirado. Solicitá uno nuevo.');
      }

      let profile = await fetchProfileByPhone(cleanPhone);
      if (!profile) {
        const msg = 'Número no registrado, por favor regístrate primero';
        set({ error: msg, isLoading: false });
        throw new Error(msg);
      }

      if (data.session?.user?.id) {
        profile = { ...profile, id: data.session.user.id };
      }

      profile = await syncProfileWithDatabase({ ...profile, role });
      if (profile.role === 'worker') {
        profile = applyPilotProfile(profile);
      }

      await ensureProfileInDb(profile);

      await safeRemovePilotProfile();

      set({
        session: data.session,
        profile,
        isPhoneAuth: false,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      if (!(err instanceof Error) || !get().error) {
        const msg = err instanceof Error ? err.message : 'No se pudo verificar el código';
        set({ error: msg, isLoading: false });
      }
      throw err instanceof Error ? err : new Error('No se pudo verificar el código');
    }
  },

  // ── registerPhoneProfile — alta sin sesión (luego login OTP) ────
  registerPhoneProfile: async (fullName, phone, role) => {
    set({ isLoading: true, error: null });
    try {
      const cleanName = fullName.trim();
      const cleanPhone = normalizePhone(phone);
      const dbRole = toDbRole(role);

      if (cleanPhone.length !== 8) {
        throw new Error('Ingresá exactamente 8 dígitos de tu celular');
      }

      const existing = await fetchProfileByPhone(cleanPhone);
      if (existing) {
        throw new Error('Este número ya está registrado. Iniciá sesión con tu celular.');
      }

      const newId = uuid4();
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: newId,
        full_name: cleanName,
        phone: cleanPhone,
        email: pilotPhoneEmail(cleanPhone),
        role: dbRole,
        is_approved: role === 'admin',
        ...(role === 'worker'
          ? { worker_status: 'incomplete' as const }
          : {}),
      });

      if (insertErr) {
        throw new Error(translateAuthError(insertErr.message));
      }

      set({ isLoading: false, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear la cuenta';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // ── phoneSignIn — experimental: name + phone, no Supabase Auth ──
  phoneSignIn: async (fullName, phone, role) => {
    set({ isLoading: true, error: null });
    try {
      const cleanName  = fullName.trim();
      const cleanPhone = normalizePhone(phone);
      const dbRole     = toDbRole(role);

      const buildLocalProfile = (id: string): UserProfile => ({
        id,
        full_name:          cleanName,
        phone:              cleanPhone,
        email:              pilotPhoneEmail(cleanPhone),
        role,
        is_approved:        false,
        worker_status:      role === 'worker' ? 'incomplete' : null,
        cedula_url:         null,
        record_policia_url: null,
        category_1:         null,
        category_2:         null,
        category_1_approved: false,
        category_2_approved: false,
        avatar_url:         null,
        stripe_account_id:  null,
        fcm_token:          null,
        created_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      } as UserProfile);

      let profile: UserProfile;

      const remoteByPhone = await fetchProfileByPhone(cleanPhone).catch(() => null);

      if (remoteByPhone) {
        if (role !== remoteByPhone.role && remoteByPhone.role !== 'admin') {
          const msg =
            role === 'worker'
              ? 'Este celular está registrado como cliente. Para recibir chambas, registrate como técnico con otro número o pedí al admin que active tu perfil de trabajador.'
              : 'Este celular está registrado como técnico. Elegí el rol Trabajador para ingresar.';
          set({ error: msg, isLoading: false });
          throw new Error(msg);
        }
        profile = {
          ...remoteByPhone,
          role: remoteByPhone.role === 'admin' ? role : remoteByPhone.role,
          full_name: cleanName,
          is_approved: !!remoteByPhone.is_approved,
        };
      } else {
        let safeMatches: UserProfile[] = [];
        try {
          const formattedPhone =
            cleanPhone.length === 8
              ? `${cleanPhone.slice(0, 4)}-${cleanPhone.slice(4)}`
              : cleanPhone;
          const { data: matches, error: searchErr } = await supabase
            .from('profiles')
            .select('*')
            .or(`phone.eq.${cleanPhone},phone.eq.${formattedPhone},full_name.eq.${cleanName}`)
            .limit(5);
          if (!searchErr && matches) safeMatches = matches as UserProfile[];
        } catch {
          safeMatches = [];
        }

        if (safeMatches.length > 0) {
          const exact = findExactProfileMatch(safeMatches, cleanName, cleanPhone);
          const byPhone = findProfileByPhone(safeMatches, cleanPhone)
            ?? safeMatches.find((r) => phonesMatch(r.phone, cleanPhone));

          if (exact) {
            if (role !== exact.role && exact.role !== 'admin') {
              const msg =
                role === 'worker'
                  ? 'Este nombre y celular pertenecen a una cuenta de cliente. No podés ingresar como técnico con los mismos datos.'
                  : 'Esta cuenta es de técnico. Elegí el rol Trabajador.';
              set({ error: msg, isLoading: false });
              throw new Error(msg);
            }
            profile = { ...exact, full_name: cleanName, is_approved: !!exact.is_approved };
          } else if (byPhone) {
            if (role !== byPhone.role && byPhone.role !== 'admin') {
              const msg =
                role === 'worker'
                  ? 'Este celular ya está registrado como cliente. Usá otro número para el perfil de técnico.'
                  : 'Este celular está registrado como técnico. Elegí el rol Trabajador.';
              set({ error: msg, isLoading: false });
              throw new Error(msg);
            }
            profile = { ...byPhone, full_name: cleanName, is_approved: !!byPhone.is_approved };
          } else if (CONFIG.pilot.enabled) {
            profile = buildLocalProfile(uuid4());
          } else {
            throw new Error(
              'Este nombre o número ya está registrado. Por favor usa tus datos correctos o intenta con otro nombre.',
            );
          }
        } else {
          const newId = uuid4();
          const localProfile = buildLocalProfile(newId);

          try {
            const { data: inserted, error: insertErr } = await supabase
              .from('profiles')
              .insert({
                id:          newId,
                full_name:   cleanName,
                phone:       cleanPhone,
                email:       pilotPhoneEmail(cleanPhone),
                role:        dbRole,
                is_approved: false,
                ...(role === 'worker'
                  ? { worker_status: 'incomplete' as const }
                  : {}),
              })
              .select()
              .single();

            if (insertErr) {
              console.warn('[phoneSignIn] DB insert blocked, using local-only profile:', insertErr.message);
              profile = localProfile;
            } else {
              profile = {
                ...(inserted as UserProfile),
                role,
                is_approved: !!(inserted as UserProfile).is_approved,
              };
            }
          } catch (insertErr) {
            console.warn('[phoneSignIn] insert offline, perfil local:', insertErr);
            profile = localProfile;
          }
        }
      }

      if (profile.role === 'worker') {
        profile = applyPilotProfile(profile);
      }

      try {
        profile = await syncProfileWithDatabase(profile);
      } catch {
        // Mantener perfil local si Supabase no responde
      }

      if (profile.role === 'worker') {
        profile = applyPilotProfile(profile);
      }

      const session = await ensurePhoneAuthSession(profile);

      await safePersistPilotProfile(profile);
      set({
        profile,
        session,
        isPhoneAuth: !session,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const msg = err.message ?? 'Error al iniciar sesión';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // ── loadFromStorage — hydrate pilot session on app start ──────
  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(PILOT_STORAGE_KEY);
      if (!raw) return false;
      let profile = JSON.parse(raw) as UserProfile;
      profile = await syncProfileWithDatabase(profile);
      if (profile.role === 'admin') {
        profile = { ...profile, role: 'admin', is_approved: true };
      } else if (profile.role === 'worker') {
        profile = applyPilotProfile(profile);
      }
      const session = await ensurePhoneAuthSession(profile);
      await safePersistPilotProfile(profile);
      set({ profile, session, isPhoneAuth: !session });
      return true;
    } catch {
      return false;
    }
  },

  // ── signOut ───────────────────────────────────────────────────
  signOut: async () => {
    useAssignmentsStore.getState().clear();
    // Limpiar UI de inmediato (evita quedar atrapado si Supabase tarda o cuelga).
    set({
      session: null,
      profile: null,
      isPhoneAuth: false,
      isLoading: false,
      error: null,
    });
    await Promise.allSettled([
      withTimeout(supabase.auth.signOut(), 4_000).catch(() => undefined),
      safeRemovePilotProfile(),
    ]);
  },

  // ── reset ─────────────────────────────────────────────────────
  reset: () =>
    set((state) => ({
      session:     null,
      profile:     null,
      isLoading:   false,
      isHydrated:  state.isHydrated,
      isPhoneAuth: false,
      error:       null,
    })),
}));

// ─── Selectors ──────────────────────────────────────────────────

export const selectIsAdmin    = (s: AuthState) => s.profile?.role === 'admin';
export const selectIsWorker   = (s: AuthState) => s.profile?.role === 'worker';
export const selectIsApproved = (s: AuthState) => s.profile?.is_approved === true;
export const selectUserId     = (s: AuthState) => s.profile?.id ?? null;

// ─── Helpers ────────────────────────────────────────────────────

/** Traduce mensajes de error de Supabase Auth al español. */
function translateAuthError(msg: string): string {
  if (msg.includes('Invalid API key'))
    return 'Clave API inválida. Verifica .env (sb_publishable_, no publisable) y reinicia con: npx expo start --clear';
  if (msg.includes('Invalid login credentials'))
    return 'Correo o contraseña incorrectos';
  if (msg.includes('Email not confirmed'))
    return 'Confirma tu correo antes de iniciar sesión';
  if (msg.includes('User already registered'))
    return 'Este correo ya tiene una cuenta registrada';
  if (msg.includes('Password should be'))
    return 'La contraseña debe tener al menos 6 caracteres';
  if (msg.includes('rate limit'))
    return 'Demasiados intentos. Espera un momento e intenta de nuevo';
  if (msg.includes('Signups not allowed') || msg.includes('shouldCreateUser'))
    return 'Número no registrado, por favor regístrate primero';
  if (msg.includes('Token has expired') || msg.includes('otp_expired'))
    return 'El código expiró. Solicitá uno nuevo.';
  if (msg.includes('Invalid OTP') || msg.includes('invalid'))
    return 'Código incorrecto. Revisá el SMS e intentá de nuevo';
  if (msg.includes('network'))
    return 'Sin conexión. Revisa tu internet';
  if (msg.includes('Database error saving new user'))
    return 'No se pudo completar el registro en el servidor. Verificá tu conexión o contactá a soporte CHAMBA.';
  return msg;
}
