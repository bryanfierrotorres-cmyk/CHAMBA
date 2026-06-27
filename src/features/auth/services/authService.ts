import { supabase } from '@services/supabase';
import type { UserProfile, UserRole } from '@/types';

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
    is_approved: role === 'admin',
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

/** Upload avatar to Supabase Storage. */
export const uploadAvatar = async (userId: string, uri: string): Promise<string> => {
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
