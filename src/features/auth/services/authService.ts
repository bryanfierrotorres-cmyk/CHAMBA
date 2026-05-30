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
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as UserProfile;
};

/** Upload avatar — Storage first, base64 data URI fallback for pilot/web. */
export const uploadAvatar = async (userId: string, uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob     = await response.blob();
  const extRaw     = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const extension  = extRaw === 'jpeg' ? 'jpg' : extRaw;
  const path       = `${userId}/avatar.${extension}`;
  const contentType = blob.type || (extension === 'png' ? 'image/png' : 'image/jpeg');

  try {
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType });

    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return data.publicUrl;
    }
    console.warn('[uploadAvatar] Storage unavailable, using base64 fallback:', error.message);
  } catch (storageErr: any) {
    console.warn('[uploadAvatar] Storage error, using base64 fallback:', storageErr.message);
  }

  return new Promise<string>((resolve, reject) => {
    const FileReaderClass = (globalThis as { FileReader?: typeof FileReader }).FileReader;
    if (FileReaderClass) {
      const reader = new FileReaderClass();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror   = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(blob);
      return;
    }
    blob.arrayBuffer().then((buf) => {
      const bytes = new Uint8Array(buf);
      let binary  = '';
      bytes.forEach((b) => { binary += String.fromCharCode(b); });
      resolve(`data:${contentType};base64,${btoa(binary)}`);
    }).catch(reject);
  });
};
