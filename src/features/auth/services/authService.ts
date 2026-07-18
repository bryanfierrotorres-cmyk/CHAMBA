import { supabase } from '@services/supabase';
import { ENV } from '@utils/env';
import { demoDb, demoLatency } from '@/demo/demoDb';
import type { UserProfile, UserRole } from '@/types';

/**
 * True cuando la app corre 100% offline con el backend demo en memoria (`demoDb`).
 *
 * Nota de arquitectura: existe un `DemoProfileRepository` (src/repositories/profile/)
 * de un piloto anterior del patrón Repository, pero NO está conectado a ninguna
 * pantalla real — ClientProfileScreen y ProfileScreen (worker) llaman directamente
 * a las funciones de este archivo. Por eso el modo demo se resuelve aquí, contra
 * `demoDb` (la misma fuente de verdad que ya usan auth/jobs/reviews/chat), y no
 * contra ese repositorio: usar ambos crearía dos estados de perfil divergentes.
 */
const IS_DEMO = ENV.DATA_MODE === 'demo';

interface RegisterParams {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: UserRole;
}

/** Sign in with email and password. */
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
};

/** Register a new user and create their profile. */
export const signUp = async ({
  email, password, fullName, phone, role,
}: RegisterParams): Promise<UserProfile> => {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (authError || !authData.user) throw new Error(authError?.message ?? 'Error al registrar');

  const profile: Omit<UserProfile, 'created_at' | 'updated_at'> = {
    id: authData.user.id,
    email,
    full_name: fullName,
    phone,
    avatar_url: null,
    role,
    is_approved: role === 'admin' || role === 'client',
    worker_status: role === 'worker' ? 'incomplete' : null,
    cedula_url: null,
    record_policia_url: null,
    category_1: null,
    category_2: null,
    category_1_approved: false,
    category_2_approved: false,
    stripe_account_id: null,
    fcm_token: null,
  };

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .insert(profile)
    .select()
    .single();

  if (profileError) throw new Error(profileError.message);
  return profileData as UserProfile;
};

/** Sign out the current user. */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};

/** Fetch profile by user ID. */
export const fetchProfile = async (userId: string): Promise<UserProfile> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);
  return data as UserProfile;
};

/** Update profile fields. */
export const updateProfile = async (
  userId: string,
  updates: Partial<Pick<UserProfile, 'full_name' | 'phone' | 'avatar_url' | 'fcm_token'>>,
) => {
  // DEMO MODE: persiste en el backend en memoria (AsyncStorage), no en Supabase.
  // Diferencia deliberada con producción: aquí SÍ se acepta un avatar_url en
  // formato data: URI (lo típico al elegir imagen en web) porque el destino es
  // almacenamiento local del dispositivo, no una fila compartida de Postgres.
  // El guard de abajo sigue protegiendo intacta la ruta de producción.
  if (IS_DEMO) {
    return demoDb.updateProfile(userId, updates);
  }

  if (updates.avatar_url != null && updates.avatar_url.startsWith('data:')) {
    throw new Error('avatar_url inválida: no se permiten imágenes en base64');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as UserProfile;
};

/** Upload avatar to Supabase Storage (producción) o al backend en memoria (demo). */
export const uploadAvatar = async (userId: string, uri: string): Promise<string> => {
  // DEMO MODE: no hay Storage real que suba nada — la URI local elegida
  // (file:// en nativo, data: en web) ya sirve directamente como fuente de
  // <Image>, igual que la URL pública que produciría el upload real.
  if (IS_DEMO) {
    await demoLatency();
    return uri;
  }

  let blob: Blob;
  let extension: string;
  let contentType: string;

  if (uri.startsWith('data:')) {
    // Web: Expo ImagePicker puede devolver data URIs.
    // Extraemos el MIME directamente en lugar de depender de la extensión del path.
    const mimeMatch  = uri.match(/^data:([^;]+);/);
    const mimeType   = mimeMatch?.[1] ?? 'image/jpeg';
    contentType      = mimeType;
    extension        = mimeType === 'image/png' ? 'png' : 'jpg';
    const base64Part = uri.slice(uri.indexOf(',') + 1);
    const byteStr    = atob(base64Part);
    const bytes      = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
    blob = new Blob([bytes], { type: mimeType });
  } else {
    // Native o blob URI
    const response = await fetch(uri);
    blob           = await response.blob();
    const extRaw   = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    extension      = extRaw === 'jpeg' ? 'jpg' : extRaw;
    contentType    = blob.type || (extension === 'png' ? 'image/png' : 'image/jpeg');
  }

  const path = `${userId}/avatar.${extension}`;

  const { error } = await supabase.storage
    .from('perfil')
    .upload(path, blob, { upsert: true, contentType });

  if (error) {
    throw new Error(`Error al subir imagen: ${error.message}`);
  }

  const { data } = supabase.storage.from('perfil').getPublicUrl(path);

  if (!data.publicUrl || !data.publicUrl.startsWith('http')) {
    throw new Error('No se obtuvo la URL pública. Verificá la configuración del bucket "perfil" en Supabase Storage.');
  }

  return data.publicUrl;
};
