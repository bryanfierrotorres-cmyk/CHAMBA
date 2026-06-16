import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@/types';
import { supabase } from '@services/supabase';
import {
  normalizePhone,
  syncProfileWithDatabase,
  fetchProfileByPhone,
  fetchProfileByPhoneQuick,
  ensureProfileInDb,
} from '@utils/profileSync';
import { useAssignmentsStore } from '@store/assignmentsStore';
import { ENV } from '@utils/env';

/** UUID v4 — uses crypto.getRandomValues for cryptographic security. */
const uuid4 = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// ─── State shape ────────────────────────────────────────────────

interface AuthState {
  // Data
  session:      Session | null;
  profile:      UserProfile | null;
  // Status flags
  isLoading:    boolean;
  isHydrated:   boolean;
  error:        string | null;

  // Setters
  setSession:  (session: Session | null)     => void;
  setProfile:  (profile: UserProfile | null) => void;
  setLoading:  (loading: boolean)            => void;
  setHydrated: (hydrated: boolean)           => void;
  setError:    (error: string | null)        => void;

  // Actions
  fetchProfile:          (userId: string)                                => Promise<void>;
  signIn:                (email: string, password: string)               => Promise<void>;
  signUp:                (params: SignUpParams)                          => Promise<void>;
  /** Verifica teléfono y envía OTP. */
  requestPhoneLoginOtp:  (phone: string)                                 => Promise<void>;
  /** Valida código SMS y abre sesión. */
  verifyPhoneLoginOtp:   (phone: string, token: string, role: UserRole)  => Promise<void>;
  /** Crea perfil en BD sin iniciar sesión (luego login OTP). */
  registerPhoneProfile:  (fullName: string, phone: string, role: UserRole) => Promise<void>;
  signOut:               ()                                              => Promise<void>;
  reset:                 ()                                              => void;
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
  error:       null,

  setSession:   (session)     => set({ session }),
  setProfile:   (profile)     => set({ profile }),
  setLoading:   (isLoading)   => set({ isLoading }),
  setHydrated:  (isHydrated)  => set({ isHydrated }),
  setError:     (error)       => set({ error }),

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

      const current = get().profile;
      if (current?.id === userId && current.avatar_url && !profile.avatar_url) {
        profile = { ...profile, avatar_url: current.avatar_url };
      }

      set({ profile });
    } catch (err: unknown) {
      console.error('[AuthStore] fetchProfile error:', (err as Error).message);
      const { profile: current, session } = get();
      if (current?.id === userId) return;
      if (current && session?.user?.id === userId) return;
      if (current && session?.access_token) return;
      set({ profile: null });
    }
  },

  // ── signIn (email + password) ─────────────────────────────────
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
    } catch (err: unknown) {
      const msg = translateAuthError((err as Error).message);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── signUp (email + password) ─────────────────────────────────
  signUp: async ({ email, password, fullName, phone, role }) => {
    set({ isLoading: true, error: null });
    try {
      const cleanPhone = normalizePhone(phone);
      if (cleanPhone.length !== 8) {
        throw new Error('Celular inválido — ingresá 8 dígitos');
      }

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
        set({ session: authData.session });
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
    } catch (err: unknown) {
      const msg = translateAuthError((err as Error).message);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── requestPhoneLoginOtp ──────────────────────────────────────
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

      if (ENV.DEV_MODE) {
        set({ isLoading: false, error: null });
        return;
      }

      const phoneE164 = `+505${cleanPhone}`;
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

  // ── verifyPhoneLoginOtp ───────────────────────────────────────
  verifyPhoneLoginOtp: async (phone, token, role) => {
    set({ isLoading: true, error: null });
    try {
      const cleanPhone = normalizePhone(phone);
      const code = token.replace(/\D/g, '');
      if (code.length < 4) {
        throw new Error('Ingresá el código que recibiste por SMS');
      }

      if (ENV.DEV_MODE && code === '123456') {
        const existing = await fetchProfileByPhone(cleanPhone);
        if (!existing) {
          const msg = 'Número no registrado, por favor regístrate primero';
          set({ error: msg, isLoading: false });
          throw new Error(msg);
        }

        const userId = existing.id;
        const fakeSession = {
          access_token: ENV.SUPABASE_ANON_KEY,
          refresh_token: ENV.SUPABASE_ANON_KEY,
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: userId,
            app_metadata: { provider: 'phone' },
            user_metadata: { full_name: existing.full_name, phone: cleanPhone, role },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        } as unknown as Session;

        await AsyncStorage.setItem('supabase.auth.token', JSON.stringify(fakeSession));

        let profile = { ...existing, id: userId };
        profile = await syncProfileWithDatabase({ ...profile, role });
        await ensureProfileInDb(profile);

        set({
          session: fakeSession,
          profile,
          isLoading: false,
          error: null,
        });
        return;
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
      await ensureProfileInDb(profile);

      set({
        session: data.session,
        profile,
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

  // ── registerPhoneProfile ──────────────────────────────────────
  registerPhoneProfile: async (fullName, phone, role) => {
    set({ isLoading: true, error: null });
    try {
      const cleanName = fullName.trim();
      const cleanPhone = normalizePhone(phone);

      if (cleanPhone.length !== 8) {
        throw new Error('Ingresá exactamente 8 dígitos de tu celular');
      }

      if (role === 'admin') {
        throw new Error('Elegí Cliente o Trabajador para registrarte.');
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
        role,
        is_approved: false,
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

  // ── signOut ───────────────────────────────────────────────────
  signOut: async () => {
    useAssignmentsStore.getState().clear();
    set({
      session: null,
      profile: null,
      isLoading: false,
      error: null,
    });
    try {
      await supabase.auth.signOut();
    } catch {
      // ignorar errores de red al cerrar sesión
    }
  },

  // ── reset ─────────────────────────────────────────────────────
  reset: () =>
    set((state) => ({
      session:    null,
      profile:    null,
      isLoading:  false,
      isHydrated: state.isHydrated,
      error:      null,
    })),
}));

// ─── Selectors ──────────────────────────────────────────────────

export const selectIsAdmin    = (s: AuthState) => s.profile?.role === 'admin';
export const selectIsWorker   = (s: AuthState) => s.profile?.role === 'worker';
export const selectIsApproved = (s: AuthState) => s.profile?.is_approved === true;
export const selectUserId     = (s: AuthState) => s.profile?.id ?? null;

// ─── Helpers ────────────────────────────────────────────────────

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid API key'))
    return 'Clave API inválida. Verificá .env y reiniciá con: npx expo start --clear';
  if (msg.includes('Invalid login credentials'))
    return 'Correo o contraseña incorrectos';
  if (msg.includes('Email not confirmed'))
    return 'Confirmá tu correo antes de iniciar sesión';
  if (msg.includes('User already registered'))
    return 'Este correo ya tiene una cuenta registrada';
  if (msg.includes('Password should be'))
    return 'La contraseña debe tener al menos 6 caracteres';
  if (msg.includes('rate limit'))
    return 'Demasiados intentos. Esperá un momento e intentá de nuevo';
  if (msg.includes('Signups not allowed') || msg.includes('shouldCreateUser'))
    return 'Número no registrado, por favor regístrate primero';
  if (msg.includes('Token has expired') || msg.includes('otp_expired'))
    return 'El código expiró. Solicitá uno nuevo.';
  if (msg.includes('Invalid OTP') || msg.includes('invalid'))
    return 'Código incorrecto. Revisá el SMS e intentá de nuevo';
  if (msg.includes('network'))
    return 'Sin conexión. Revisá tu internet';
  if (msg.includes('Database error saving new user'))
    return 'No se pudo completar el registro. Verificá tu conexión.';
  return msg;
}