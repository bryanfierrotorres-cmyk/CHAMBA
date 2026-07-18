import { supabase } from '@services/supabase';

export interface AppConfigRow {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

/** app_config: RLS ya permite lectura pública y escritura solo-admin (migración 073). */
export const fetchAppConfig = async (): Promise<AppConfigRow[]> => {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value, description, updated_at')
    .order('key', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AppConfigRow[];
};

export const updateAppConfigValue = async (key: string, value: string): Promise<void> => {
  const { error } = await supabase
    .from('app_config')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key);

  if (error) throw new Error(error.message);
};
