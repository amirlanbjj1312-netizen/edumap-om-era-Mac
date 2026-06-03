import { supabase } from '@/lib/supabaseClient';

export const supabaseAuth = {
  auth: supabase.auth,
};

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}
