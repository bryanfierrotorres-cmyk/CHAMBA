import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@/types';
import { supabase } from '@services/supabase';
import { CONFIG } from '@constants/config';
import { applyPilotProfile } from '@utils/pilotAccess';
import {
  normalizePhone,
  syncProfileWithDatabase,
  findExactProfileMatch,
  findProfileByPhone,
  fetchProfileByPhone,
} from '@utils/profileSync';

const PILOT_STORAGE_KEY = 'CHAMBA_PILOT_PROFILE';

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
  /** Experimental phone auth — no Supabase Auth session, profiles table only. */
  phoneSignIn:     (fullName: string, phone: string, role: UserRole) => Promise<void>;
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
          cedula_url:        profile.cedula_url        ?? 'pilot-bypass',
          record_policia_url: profile.record_policia_url ?? 'pilot-bypass',
        });
      }
      set({ profile });
    } catch (err: any) {
      console.error('[AuthStore] fetchProfile error:', err.message);
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
      // 1. Crear usuario en auth.users
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
          },
        },
      });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      // 2. El trigger fn_handle_new_user() crea el perfil automáticamente.
      //    Hacemos upsert explícito para garantizar phone y datos adicionales.
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id:         authData.user.id,
        email:      email.trim().toLowerCase(),
        full_name:  fullName.trim(),
        phone:      phone.trim() || null,
        role,
        is_approved: role === 'admin',
      });
      if (profileErr) throw profileErr;

      await get().fetchProfile(authData.user.id);
    } catch (err: any) {
      const msg = translateAuthError(err.message);
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── pilotSignIn — acceso rápido para prueba piloto ─────────────
  pilotSignIn: async (role = 'worker') => {
    const creds = role === 'admin' ? CONFIG.pilot.admin : CONFIG.pilot.worker;
    set({ isLoading: true, error: null });

    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email:    creds.email,
        password: creds.password,
      });

      // Si no existe, crear cuenta automáticamente
      if (error?.message.includes('Invalid login credentials')) {
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
      }

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

  // ── phoneSignIn — experimental: name + phone, no Supabase Auth ──
  phoneSignIn: async (fullName, phone, role) => {
    set({ isLoading: true, error: null });
    try {
      const cleanName  = fullName.trim();
      const cleanPhone = normalizePhone(phone);

      // 'client' may not yet exist in the DB user_role enum.
      // We store 'worker' in the DB and override locally with the real role.
      const DB_SAFE_ROLE = role === 'client' ? 'worker' : role;

      // 1. Search by phone OR name (check both for conflict detection)
      const { data: matches, error: searchErr } = await supabase
        .from('profiles')
        .select('*')
        .or(`phone.eq.${cleanPhone},full_name.eq.${cleanName}`)
        .limit(5);

      // If SELECT fails (RLS or network), treat as "new user" and proceed locally
      const safeMatches = searchErr ? [] : (matches ?? []);

      let profile: UserProfile;

      const remoteByPhone = await fetchProfileByPhone(cleanPhone);

      if (remoteByPhone) {
        profile = applyPilotProfile({
          ...remoteByPhone,
          role,
          full_name: cleanName,
        });
      } else if (safeMatches.length > 0) {
        const exact = findExactProfileMatch(
          safeMatches as UserProfile[],
          cleanName,
          cleanPhone,
        );
        const byPhone = findProfileByPhone(safeMatches as UserProfile[], cleanPhone);

        if (exact) {
          profile = applyPilotProfile({ ...exact, role });
        } else if (byPhone && CONFIG.pilot.enabled) {
          profile = applyPilotProfile({ ...byPhone, role, full_name: cleanName });
        } else {
          throw new Error(
            'Este nombre o número ya está registrado. Por favor usa tus datos correctos o intenta con otro nombre.',
          );
        }
      } else {
        // 2. New user — try to insert into Supabase, fall back to local-only
        const newId = uuid4();

        const localProfile: UserProfile = {
          id:                 newId,
          full_name:          cleanName,
          phone:              cleanPhone,
          email:              `${cleanPhone}@chamba-pilot.app`,
          role,
          is_approved:        true,
          worker_status:      'active',
          cedula_url:         'pilot-bypass',
          record_policia_url: 'pilot-bypass',
          category_1:         null,
          category_2:         null,
          category_1_approved: false,
          category_2_approved: false,
          avatar_url:         null,
          bio:                null,
          skills:             [],
          rating:             0,
          total_jobs:         0,
          created_at:         new Date().toISOString(),
        } as unknown as UserProfile;

        const { data: inserted, error: insertErr } = await supabase
          .from('profiles')
          .insert({
            id:          newId,
            full_name:   cleanName,
            phone:       cleanPhone,
            email:       `${cleanPhone}@chamba-pilot.app`,
            role:        DB_SAFE_ROLE,
            is_approved: true,
          })
          .select()
          .single();

        if (insertErr) {
          console.warn('[phoneSignIn] DB insert blocked, using local-only profile:', insertErr.message);
          profile = applyPilotProfile(localProfile);
        } else {
          profile = applyPilotProfile({ ...(inserted as UserProfile), role });
        }
      }

      // Ensure pilot workers bypass onboarding gate
      if (CONFIG.pilot.enabled && profile.role === 'worker') {
        profile = applyPilotProfile(profile);
      }

      profile = await syncProfileWithDatabase(profile);

      // 3. Persist locally so the user stays logged in between app opens
      await AsyncStorage.setItem(PILOT_STORAGE_KEY, JSON.stringify(profile));
      set({ profile, isPhoneAuth: true, isLoading: false });
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
      if (CONFIG.pilot.enabled && profile.role === 'worker') {
        profile = applyPilotProfile(profile);
      }
      await AsyncStorage.setItem(PILOT_STORAGE_KEY, JSON.stringify(profile));
      set({ profile, isPhoneAuth: true });
      return true;
    } catch {
      return false;
    }
  },

  // ── signOut ───────────────────────────────────────────────────
  signOut: async () => {
    set({ isLoading: true });
    const { useAssignmentsStore } = await import('@store/assignmentsStore');
    useAssignmentsStore.getState().clear();
    await Promise.allSettled([
      supabase.auth.signOut(),
      AsyncStorage.removeItem(PILOT_STORAGE_KEY),
    ]);
    set({
      session: null,
      profile: null,
      isPhoneAuth: false,
      isLoading: false,
      error: null,
    });
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
  if (msg.includes('network'))
    return 'Sin conexión. Revisa tu internet';
  return msg;
}
